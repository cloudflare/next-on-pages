import { readFile, writeFile, mkdir, rm, readdir, copyFile } from 'fs/promises';
import { exit } from 'process';
import { dirname, join, relative, resolve } from 'path';
import type { Node } from 'acorn';
import { parse } from 'acorn';
import { generate } from 'astring';
import {
	formatRoutePath,
	normalizePath,
	readJsonFile,
	stripIndexRoute,
	validateDir,
	validateFile,
} from '../utils';
import type { CliOptions } from '../cli';
import { cliError, cliWarn } from '../cli';
import { tmpdir } from 'os';

/**
 * Creates new files containing the Vercel built functions but adjusted so that they can be later
 * bundled in our worker and generates a map that maps the Vercel original function paths (without the `.func` extension)
 * to the newly generated files.
 *
 * if experimentalMinify is set to true additionally as part of the functions map generation this functions also extracts
 * webpack chunks, adds imports to such chunks in the functions themselves, and filters out duplicated chunks.
 *
 * @param functionsDir path of the directory of Next.js functions built by Vercel
 * @param experimentalMinify flag indicating wether to use the experimental minify
 * @returns an object containing the generated functions map and also a set of paths of invalid functions (if any is present)
 */
export async function generateFunctionsMap(
	functionsDir: string,
	experimentalMinify: CliOptions['experimentalMinify']
): Promise<
	Pick<DirectoryProcessingResults, 'functionsMap' | 'invalidFunctions'>
> {
	const processingSetup = {
		functionsDir,
		tmpFunctionsDir: join(tmpdir(), Math.random().toString(36).slice(2)),
		tmpWebpackDir: join(tmpdir(), Math.random().toString(36).slice(2)),
		experimentalMinify,
	};

	const processingResults = await processDirectoryRecursively(
		processingSetup,
		functionsDir
	);

	await tryToFixInvalidFunctions(processingResults);

	if (experimentalMinify) {
		await buildWebpackChunkFiles(
			processingResults.webpackChunks,
			processingSetup.tmpWebpackDir
		);
	}

	return processingResults;
}

/**
 * Process the invalid functions and check whether and valid function was created in the functions
 * map to override it.
 *
 * The build output sometimes generates invalid functions at the root, while still creating the
 * valid functions. With the base path and route groups, it might create the valid edge function
 * inside a folder for the route group, but create an invalid one that maps to the same path
 * at the root.
 *
 * When we process the directory, we might add the valid function to the map before we process the
 * invalid one, so we need to check if the invalid one was added to the map and remove it from the
 * set if it was.
 *
 * If the invalid function is an RSC function (e.g. `path.rsc`) and doesn't have a valid squashed
 * version, we check if a squashed non-RSC function exists (e.g. `path`) and use this instead. RSC
 * functions are the same as non-RSC functions, per the Vercel source code.
 * https://github.com/vercel/vercel/blob/main/packages/next/src/server-build.ts#L1193
 *
 * @param processingResults Object containing the results of processing the current function directory.
 */
async function tryToFixInvalidFunctions({
	functionsMap,
	invalidFunctions,
}: DirectoryProcessingResults): Promise<void> {
	if (invalidFunctions.size === 0) {
		return;
	}

	for (const rawPath of invalidFunctions) {
		const formattedPath = formatRoutePath(rawPath);

		if (
			functionsMap.has(formattedPath) ||
			functionsMap.has(stripIndexRoute(formattedPath))
		) {
			invalidFunctions.delete(rawPath);
		} else if (formattedPath.endsWith('.rsc')) {
			const value = functionsMap.get(formattedPath.replace(/\.rsc$/, ''));

			if (value) {
				functionsMap.set(formattedPath, value);
				invalidFunctions.delete(rawPath);
			}
		}
	}
}

async function processDirectoryRecursively(
	setup: ProcessingSetup,
	dir: string
): Promise<DirectoryProcessingResults> {
	const invalidFunctions = new Set<string>();
	const functionsMap = new Map<string, string>();
	const webpackChunks = new Map<number, string>();

	const files = await readdir(dir);

	await Promise.all(
		files.map(async file => {
			const filepath = join(dir, file);
			if (await validateDir(filepath)) {
				const dirResultsPromise = file.endsWith('.func')
					? processFuncDirectory(setup, file, filepath)
					: processDirectoryRecursively(setup, filepath);
				const dirResults = await dirResultsPromise;
				dirResults.invalidFunctions?.forEach(fn => invalidFunctions.add(fn));
				dirResults.functionsMap?.forEach((value, key) =>
					functionsMap.set(key, value)
				);
				dirResults.webpackChunks?.forEach((value, key) =>
					webpackChunks.set(key, value)
				);
			}
		})
	);

	return {
		invalidFunctions,
		functionsMap,
		webpackChunks,
	};
}

type FunctionConfig = {
	runtime: 'edge' | 'nodejs';
	name: string;
	deploymentTarget: 'v8-worker' | string;
	entrypoint: string;
	envVarsInUse?: string[];
	assets?: { name: string; path: string }[];
	regions?: string | string[];
	framework?: { slug: string; version?: string };
};

async function processFuncDirectory(
	setup: ProcessingSetup,
	file: string,
	filepath: string
): Promise<Partial<DirectoryProcessingResults>> {
	const relativePath = relative(setup.functionsDir, filepath);

	const functionConfig = await readJsonFile<FunctionConfig>(
		join(filepath, '.vc-config.json')
	);

	if (functionConfig?.runtime !== 'edge') {
		if (file === 'favicon.ico.func') {
			await tryToFixFaviconFunc();
			return {};
		}
		return {
			invalidFunctions: new Set([file]),
		};
	}

	// There are instances where the build output will generate an uncompiled `middleware.js` file that is used as the entrypoint.
	// TODO: investigate when and where the file is generated.
	// This file is not able to be used as it is uncompiled, so we try to instead use the compiled `index.js` if it exists.
	let isMiddleware = false;
	if (functionConfig.entrypoint === 'middleware.js') {
		isMiddleware = true;
		functionConfig.entrypoint = 'index.js';
	}

	const functionFile = join(filepath, functionConfig.entrypoint);
	if (!(await validateFile(functionFile))) {
		if (isMiddleware) {
			// We sometimes encounter an uncompiled `middleware.js` with no compiled `index.js` outside of a base path.
			// Outside the base path, it should not be utilised, so it should be safe to ignore the function.
			cliWarn(
				`Detected an invalid middleware function for ${relativePath}. Skipping...`
			);
			return {};
		}

		return {
			invalidFunctions: new Set([file]),
		};
	}

	const functionsMap = new Map<string, string>();
	const webpackChunks = new Map<number, string>();

	let contents = await readFile(functionFile, 'utf8');
	contents = fixFunctionContents(contents);

	if (setup.experimentalMinify) {
		const { updatedFunctionContents, extractedWebpackChunks } =
			extractWebpackChunks(setup.tmpWebpackDir, contents, webpackChunks);
		contents = updatedFunctionContents;
		extractedWebpackChunks.forEach((value, key) =>
			webpackChunks.set(key, value)
		);
	}

	const newFilePath = join(setup.tmpFunctionsDir, `${relativePath}.js`);
	await mkdir(dirname(newFilePath), { recursive: true });
	await writeFile(newFilePath, contents);

	const formattedPathName = formatRoutePath(relativePath);
	const normalizedFilePath = normalizePath(newFilePath);

	functionsMap.set(formattedPathName, normalizedFilePath);

	if (formattedPathName.endsWith('/index')) {
		// strip `/index` from the path name as the build output config doesn't rewrite `/index` to `/`
		functionsMap.set(stripIndexRoute(formattedPathName), normalizedFilePath);
	}

	return {
		functionsMap,
		webpackChunks,
	};
}

/**
 * Fixes the function contents in miscellaneous ways.
 *
 * Note: this function contains hacks which are quite brittle and should be improved ASAP.
 *
 * @param contents the original function's file contents
 * @returns the updated/fixed contents
 */
function fixFunctionContents(contents: string) {
	contents = contents.replace(
		// TODO: This hack is not good. We should replace this with something less brittle ASAP
		// https://github.com/vercel/next.js/blob/2e7dfca362931be99e34eccec36074ab4a46ffba/packages/next/src/server/web/adapter.ts#L276-L282
		/(Object.defineProperty\(globalThis,\s*"__import_unsupported",\s*{[\s\S]*?configurable:\s*)([^,}]*)(.*}\s*\))/gm,
		'$1true$3'
	);

	// TODO: Investigate alternatives or a real fix. This hack is rather brittle.
	// The workers runtime does not implement certain properties like `mode` or `credentials`.
	// Due to this, we need to replace them with null so that request deduping cache key generation will work.
	// https://github.com/vercel/next.js/blob/canary/packages/next/src/compiled/react/cjs/react.shared-subset.development.js#L198
	contents = contents.replace(
		/(?:(JSON\.stringify\(\[\w+\.method\S+,)\w+\.mode(,\S+,)\w+\.credentials(,\S+,)\w+\.integrity(\]\)))/gm,
		'$1null$2null$3null$4'
	);
	return contents;
}

/**
 * Given the contents of a function's file it extracts webpack chunks from it so that they can be de-duplicated.
 *
 * @param tmpWebpackDir path of tmp dir to use for the webpack chunks
 * @param functionContents the contents of the function's file
 * @param existingWebpackChunks the existing collected webpack chunks (so that we can validate new ones against them)
 *
 * @returns an object containing the extractedWebpackChunks and the function's file content updated so that it imports/requires
 * those chunks
 */
function extractWebpackChunks(
	tmpWebpackDir: string,
	functionContents: string,
	existingWebpackChunks: Map<number, string>
): {
	updatedFunctionContents: string;
	extractedWebpackChunks: Map<number, string>;
} {
	const webpackChunks = new Map<number, string>();

	const parsedContents = parse(functionContents, {
		ecmaVersion: 'latest',
		sourceType: 'module',
	}) as Node & { body: LooseNode[] };

	const expressions = parsedContents.body
		.filter(
			({ type, expression }) =>
				type === 'ExpressionStatement' &&
				expression?.type === 'CallExpression' &&
				expression.callee?.type === 'MemberExpression' &&
				expression.callee.object?.type === 'AssignmentExpression' &&
				expression.callee.object.left?.object?.name === 'self' &&
				expression.callee.object.left.property?.name === 'webpackChunk_N_E' &&
				expression.arguments?.[0]?.elements?.[1]?.type === 'ObjectExpression'
		)
		.map(
			node => node?.expression?.arguments?.[0]?.elements?.[1]?.properties
		) as LooseNode[][];

	for (const objectOfChunks of expressions) {
		for (const chunkExpression of objectOfChunks) {
			const key = chunkExpression?.key?.value;
			if (key in existingWebpackChunks) {
				if (
					existingWebpackChunks.get(key) !== generate(chunkExpression.value)
				) {
					cliError(
						`
							ERROR: Detected a collision with '--experimental-minify'.
							       Try removing the '--experimental-minify' argument.
						`,
						{ spaced: true }
					);
					exit(1);
				}
			}

			webpackChunks.set(key, generate(chunkExpression.value));

			const chunkFilePath = join(tmpWebpackDir, `${key}.js`);

			const newValue = {
				type: 'MemberExpression',
				object: {
					type: 'CallExpression',
					callee: {
						type: 'Identifier',
						name: 'require',
					},
					arguments: [
						{
							type: 'Literal',
							value: chunkFilePath,
							raw: JSON.stringify(chunkFilePath),
						},
					],
				},
				property: {
					type: 'Identifier',
					name: 'default',
				},
			};

			chunkExpression.value = newValue;
		}
	}

	return {
		updatedFunctionContents: generate(parsedContents),
		extractedWebpackChunks: webpackChunks,
	};
}

async function buildWebpackChunkFiles(
	webpackChunks: Map<number, string>,
	tmpWebpackDir: string
) {
	for (const [chunkIdentifier, code] of webpackChunks) {
		const chunkFilePath = join(tmpWebpackDir, `${chunkIdentifier}.js`);
		await mkdir(dirname(chunkFilePath), { recursive: true });
		await writeFile(chunkFilePath, `export default ${code}`);
	}
}

/**
 * Next.js generates a favicon nodejs function instead of providing the favicon as
 * a standard static asset. Since it is not using the edge runtime we can't use the
 * function itself, so this function tries to see if it can find the standard favicon
 * in the .vercel/output/static/static/media/metadata directory generated by Next.js
 * and moves that one in the static output directory instead.
 */
async function tryToFixFaviconFunc(): Promise<void> {
	try {
		const staticMediaMetadata = resolve(
			'.vercel',
			'output',
			'static',
			'static',
			'media',
			'metadata'
		);
		const files = await readdir(staticMediaMetadata);
		const favicon = files.find(file =>
			/^favicon\.[a-zA-Z0-9]+\.ico$/.test(file)
		);
		if (favicon) {
			const faviconFilePath = join(staticMediaMetadata, favicon);
			const vercelStaticFavicon = resolve(
				'.vercel',
				'output',
				'static',
				'favicon.ico'
			);
			await copyFile(faviconFilePath, vercelStaticFavicon);
		}
		// let's delete the .vercel/output/static/static directory so that extra media
		// files are not uploaded unnecessarily to Cloudflare Pages
		const staticStaticDir = resolve('.vercel', 'output', 'static', 'static');
		await rm(staticStaticDir, { recursive: true, force: true });
	} catch {
		cliWarn('Warning: No static favicon file found');
	}
}

type ProcessingSetup = {
	functionsDir: string;
	tmpFunctionsDir: string;
	tmpWebpackDir: string;
	experimentalMinify: boolean;
};

type DirectoryProcessingResults = {
	invalidFunctions: Set<string>;
	functionsMap: Map<string, string>;
	webpackChunks: Map<number, string>;
};

type LooseNode = Node & {
	expression?: LooseNode;
	callee?: LooseNode;
	object?: LooseNode;
	left?: LooseNode;
	right?: LooseNode;
	property?: LooseNode;
	arguments?: LooseNode[];
	elements?: LooseNode[];
	properties?: LooseNode[];
	key?: LooseNode;
	name?: string;
	/*
    eslint-disable-next-line @typescript-eslint/no-explicit-any 
    -- TODO: improve the type of value
  */
	value: any;
};
