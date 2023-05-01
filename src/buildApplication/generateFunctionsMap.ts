import { readFile, writeFile, mkdir, rm, readdir, copyFile } from 'fs/promises';
import { exit } from 'process';
import { dirname, join, relative, resolve } from 'path';
import type { Node } from 'acorn';
import { parse } from 'acorn';
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
import type * as AST from 'ast-types/gen/kinds';
import assert from 'node:assert';
import type { PrerenderedFileData } from './fixPrerenderedRoutes';
import { fixPrerenderedRoutes } from './fixPrerenderedRoutes';

/**
 * Creates new files containing the Vercel built functions but adjusted so that they can be later
 * bundled in our worker and generates a map that maps the Vercel original function paths (without the `.func` extension)
 * to the newly generated files.
 *
 * As part of the functions map generation this functions also extracts webpack chunks, adds imports to such chunks in the
 * functions themselves, and filters out duplicated chunks, such operation is skipped it disableChunksDedup is true.
 *
 * @param functionsDir path of the directory of Next.js functions built by Vercel
 * @param disableChunksDedup flag indicating wether the chunks de-duplication should be disabled
 * @returns an object containing the generated functions map and also a set of paths of invalid functions (if any is present)
 */
export async function generateFunctionsMap(
	functionsDir: string,
	disableChunksDedup: CliOptions['disableChunksDedup']
): Promise<DirectoryProcessingResults> {
	const processingSetup = {
		functionsDir,
		tmpFunctionsDir: join(tmpdir(), Math.random().toString(36).slice(2)),
		tmpWebpackDir: join(tmpdir(), Math.random().toString(36).slice(2)),
		disableChunksDedup,
	};

	const processingResults = await processDirectoryRecursively(
		processingSetup,
		functionsDir
	);

	await tryToFixInvalidFunctions(processingResults);

	if (!disableChunksDedup) {
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
	const prerenderedRoutes = new Map<string, PrerenderedFileData>();

	const files = await readdir(dir);
	const functionFiles = await fixPrerenderedRoutes(
		prerenderedRoutes,
		files,
		dir
	);

	await Promise.all(
		functionFiles.map(async file => {
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
				dirResults.prerenderedRoutes?.forEach((value, key) =>
					prerenderedRoutes.set(key, value)
				);
			}
		})
	);

	return {
		invalidFunctions,
		functionsMap,
		webpackChunks,
		prerenderedRoutes,
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
			invalidFunctions: new Set([relativePath]),
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
			invalidFunctions: new Set([relativePath]),
		};
	}

	const functionsMap = new Map<string, string>();
	const webpackChunks = new Map<number, string>();

	let contents = await readFile(functionFile, 'utf8');
	contents = fixFunctionContents(contents);

	if (!setup.disableChunksDedup) {
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
	const webpackChunksCodeReplaceMap = new Map<string, string>();

	const parsedContents = parse(functionContents, {
		ecmaVersion: 'latest',
		sourceType: 'module',
	}) as unknown as AST.ProgramKind;

	const chunks = parsedContents.body.flatMap(getWebpackChunksFromStatement);

	chunks.forEach(chunk => {
		const key = (chunk.key as AST.NumericLiteralKind).value;

		const chunkExpressionCode = functionContents.slice(
			(chunk.value as Node).start,
			(chunk.value as Node).end
		);

		if (
			existingWebpackChunks.has(key) &&
			existingWebpackChunks.get(key) !== chunkExpressionCode
		) {
			cliError(
				`
							ERROR: Detected a collision with the webpack chunks deduplication.
							       Try adding the '--disable-chunks-dedup' argument to temporarily solve the issue.
						`,
				{ spaced: true, showReport: true }
			);
			exit(1);
		}

		webpackChunks.set(key, chunkExpressionCode);

		const chunkFilePath = join(tmpWebpackDir, `${key}.js`);

		const newChunkExpressionCode = `require(${JSON.stringify(
			chunkFilePath
		)}).default`;

		webpackChunksCodeReplaceMap.set(
			chunkExpressionCode,
			newChunkExpressionCode
		);
	});

	webpackChunksCodeReplaceMap.forEach((newChunkCode, chunkCode) => {
		functionContents = functionContents.replace(chunkCode, newChunkCode);
	});

	return {
		updatedFunctionContents: functionContents,
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
	disableChunksDedup: boolean;
};

type DirectoryProcessingResults = {
	invalidFunctions: Set<string>;
	functionsMap: Map<string, string>;
	webpackChunks: Map<number, string>;
	prerenderedRoutes: Map<string, PrerenderedFileData>;
};

/**
 * Verifies wether the provided AST statement represents a javascript code
 * of the following format:
 * 	```
 * 		(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push(...,
 * 			{
 * 				[chunkNumberA]: e => { ... },
 * 				[chunkNumberB]: e => { ... },
 * 				[chunkNumberC]: e => { ... },
 * 				...
 * 			}
 * 		]);
 *  ```
 * and in such case it extracts the various chunk properties.
 *
 * @param statement the AST statement to check
 *
 * @returns the chunks as an array of AST Properties if the statement represent the target javascript code, an empty array otherwise
 */
function getWebpackChunksFromStatement(
	statement: AST.StatementKind
): AST.PropertyKind[] {
	try {
		assert(statement.type === 'ExpressionStatement');
		const expr = statement.expression;

		assert(expr.type === 'CallExpression');
		assert(expr.callee.type === 'MemberExpression');
		assert(expr.callee.property.type === 'Identifier');
		assert(expr.callee.property.name === 'push');
		const calleeObj = expr.callee.object;

		assert(calleeObj.type === 'AssignmentExpression');

		assertSelfWebpackChunk_N_E(calleeObj.left);

		assert(calleeObj.right.type === 'LogicalExpression');
		assert(calleeObj.right.operator === '||');
		assertSelfWebpackChunk_N_E(calleeObj.right.left);
		assert(calleeObj.right.right.type === 'ArrayExpression');
		assert(calleeObj.right.right.elements.length === 0);

		assert(expr.arguments[0]?.type === 'ArrayExpression');
		assert(expr.arguments[0].elements[1]?.type === 'ObjectExpression');

		return expr.arguments[0].elements[1].properties.filter(
			p =>
				p.type === 'Property' &&
				p.key.type === 'Literal' &&
				typeof p.key.value === 'number' &&
				p.value.type === 'ArrowFunctionExpression'
		) as AST.PropertyKind[];
	} catch {
		return [];
	}
}

/**
 * Asserts whether the provided AST node represents `self.webpackChunk_N_E`
 * (throws an AssertionError it doesn't)
 */
function assertSelfWebpackChunk_N_E(expression: AST.NodeKind): void {
	assert(expression.type === 'MemberExpression');
	assert(expression.object.type === 'Identifier');
	assert(expression.object.name === 'self');
	assert(expression.property.type === 'Identifier');
	assert(expression.property.name === 'webpackChunk_N_E');
}
