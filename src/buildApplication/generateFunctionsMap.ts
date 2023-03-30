import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { exit } from 'process';
import { dirname, join, relative } from 'path';
import { parse, Node } from 'acorn';
import { generate } from 'astring';
import {
	normalizePath,
	readJsonFile,
	validateDir,
	validateFile,
} from '../utils';
import { cliError, CliOptions } from '../cli';
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
): Promise<{
	functionsMap: Map<string, string>;
	invalidFunctions: Set<string>;
}> {
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

	if (experimentalMinify) {
		await buildWebpackChunkFiles(
			processingResults.webpackChunks,
			processingSetup.tmpWebpackDir
		);
	}

	return processingResults;
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
		return {
			invalidFunctions: new Set([file]),
		};
	}

	const functionFile = join(filepath, functionConfig.entrypoint);
	if (!(await validateFile(functionFile))) {
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

	functionsMap.set(
		normalizePath(
			relative(setup.functionsDir, filepath).slice(0, -'.func'.length)
		),
		normalizePath(newFilePath)
	);

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
					cliError("ERROR: Detected a collision with '--experimental-minify'.");
					cliError("Try removing the '--experimental-minify' argument.", true);
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
