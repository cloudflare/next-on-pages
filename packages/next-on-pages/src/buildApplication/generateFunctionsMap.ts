import { readFile, writeFile, mkdir, readdir, copyFile } from 'fs/promises';
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
import type * as AST from 'ast-types/gen/kinds';
import type { PrerenderedFileData } from './fixPrerenderedRoutes';
import { fixPrerenderedRoutes } from './fixPrerenderedRoutes';
import type { Plugin } from 'esbuild';
import { build } from 'esbuild';

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
	outputDir: string,
	disableChunksDedup: CliOptions['disableChunksDedup']
): Promise<DirectoryProcessingResults> {
	const nextOnPagesDistDir = join(
		outputDir,
		'_worker.js',
		'__next-on-pages-dist__'
	);

	const processingSetup = {
		functionsDir,
		distFunctionsDir: join(nextOnPagesDistDir, 'functions'),
		distWebpackDir: join(nextOnPagesDistDir, 'chunks'),
		disableChunksDedup,
		outputDir,
	};

	const processingResults = await processDirectoryRecursively(
		processingSetup,
		functionsDir
	);

	await tryToFixInvalidFunctions(processingResults);

	if (!disableChunksDedup) {
		await buildWebpackChunkFiles(
			processingResults.webpackChunks,
			processingSetup.distWebpackDir,
			processingResults.wasmIdentifiers
		);
	}

	if (processingResults.wasmIdentifiers.size) {
		await copyWasmFiles(nextOnPagesDistDir, processingResults.wasmIdentifiers);
	}

	if (processingResults.nextJsManifests.size) {
		await createNextJsManifestFiles(
			nextOnPagesDistDir,
			processingResults.nextJsManifests
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

type WasmModuleInfo = {
	identifier: string;
	importPath: string;
	originalFileLocation: string;
};

async function processDirectoryRecursively(
	setup: ProcessingSetup,
	dir: string
): Promise<DirectoryProcessingResults> {
	const invalidFunctions = new Set<string>();
	const functionsMap = new Map<string, string>();
	const webpackChunks = new Map<number, string>();
	const prerenderedRoutes = new Map<string, PrerenderedFileData>();
	const wasmIdentifiers = new Map<string, WasmModuleInfo>();
	const nextJsManifests = new Map<string, string>();

	const files = await readdir(dir);
	const functionFiles = await fixPrerenderedRoutes(
		prerenderedRoutes,
		files,
		dir,
		setup.outputDir
	);

	// Note: the following could be implemented via `await Promise.all` since different directories are independent to each other
	//       unfortunately this can cause large application to require unreasonably large memory to build, so we need to do a
	//       simpler and slower loop with awaits instead
	for (const file of functionFiles) {
		const filepath = join(dir, file);
		if (await validateDir(filepath)) {
			const dirResultsPromise = file.endsWith('.func')
				? processFuncDirectory(setup, filepath)
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
			dirResults.wasmIdentifiers?.forEach((value, key) =>
				wasmIdentifiers.set(key, value)
			);
			dirResults.nextJsManifests?.forEach((value, key) =>
				nextJsManifests.set(key, value)
			);
		}
	}

	return {
		invalidFunctions,
		functionsMap,
		webpackChunks,
		prerenderedRoutes,
		wasmIdentifiers,
		nextJsManifests,
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
	filepath: string
): Promise<Partial<DirectoryProcessingResults>> {
	const relativePath = relative(setup.functionsDir, filepath);

	const functionConfig = await readJsonFile<FunctionConfig>(
		join(filepath, '.vc-config.json')
	);

	if (functionConfig?.runtime !== 'edge') {
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

	const functionFilePath = join(filepath, functionConfig.entrypoint);
	if (!(await validateFile(functionFilePath))) {
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

	let contents = await readFile(functionFilePath, 'utf8');
	contents = fixFunctionContents(contents);

	let wasmIdentifiers = new Map<string, WasmModuleInfo>();

	if (!setup.disableChunksDedup) {
		const {
			updatedFunctionContents,
			extractedWebpackChunks,
			wasmIdentifiers: funcWasmIdentifiers,
		} = await extractWebpackChunks(contents, functionFilePath, webpackChunks);
		extractedWebpackChunks.forEach((value, key) =>
			webpackChunks.set(key, value)
		);
		contents = updatedFunctionContents;
		wasmIdentifiers = funcWasmIdentifiers;
	} else {
		const { wasmIdentifiers: funcWasmIdentifiers, updatedContents } =
			await extractAndFixWasmRequires(functionFilePath, contents);
		contents = updatedContents;
		wasmIdentifiers = funcWasmIdentifiers;
	}

	const { manifests: nextJsManifests, updatedContents } =
		await extractNextJsManifests(functionFilePath, contents);
	contents = updatedContents;

	const newFilePath = join(setup.distFunctionsDir, `${relativePath}.js`);
	await mkdir(dirname(newFilePath), { recursive: true });
	const relativeNextOnPagesDistPath =
		getRelativeNextOnPagesDistPath(functionFilePath);
	await build({
		stdin: {
			contents,
		},
		target: 'es2022',
		platform: 'neutral',
		outfile: newFilePath,
		bundle: true,
		external: ['node:*', `${relativeNextOnPagesDistPath}/*`, '*.wasm'],
		minify: true,
		plugins: [nodeBuiltInModulesPlugin],
	});
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
		wasmIdentifiers,
		nextJsManifests,
	};
}

type RawWasmModuleInfo = {
	identifier: string;
	importPath: string;
	start: number;
	end: number;
};

/**
 * Given the path of a function file and its content update the content so that it doesn't include dynamic
 * requires to wasm modules. Such requires are instead converted into standard esm imports.
 *
 * As a side effect this function also updates the file with the new content.
 *
 * @param functionFilePath file path of the function file
 * @param originalFileContents the (original) contents of the file
 * @returns the updated content and a map of wasmIdentifiers that can be used to copy the wasm files in the correct location
 *          after all the functions have been parsed
 */
async function extractAndFixWasmRequires(
	functionFilePath: string,
	originalFileContents: string
): Promise<{
	wasmIdentifiers: Map<string, WasmModuleInfo>;
	updatedContents: string;
}> {
	const program = parse(originalFileContents, {
		ecmaVersion: 'latest',
		sourceType: 'module',
	}) as unknown as AST.ProgramKind;

	const wasmIdentifiers = new Map<string, WasmModuleInfo>();

	const rawWasmIdentifiers = program.body
		.map(getWasmIdentifier)
		.filter(Boolean) as RawWasmModuleInfo[];

	let updatedContents = originalFileContents;
	rawWasmIdentifiers.forEach(({ identifier, importPath, start, end }) => {
		wasmIdentifiers.set(identifier, {
			identifier,
			importPath,
			originalFileLocation: join(
				dirname(functionFilePath),
				'wasm',
				`${identifier}.wasm`
			),
		});
		const originalWasmModuleRequire = originalFileContents.slice(start, end);
		updatedContents = updatedContents.replace(
			originalWasmModuleRequire,
			`import ${identifier} from "${'../'.repeat(
				getFunctionNestingLevel(functionFilePath) - 1
			)}wasm/${identifier}.wasm";`
		);
	});

	await writeFile(functionFilePath, updatedContents);

	return { wasmIdentifiers, updatedContents };
}

/**
 * Given the path of a function file and its content update the content so that it doesn't include Next.js manifests but imports them
 * from the __next-on-pages-dist__/nextjs-manifests directory.
 *
 * Note: Such manifests are always the same for all functions so we need to share them across the various function files instead of costly duplicating them in each file.
 *
 * As a side effect this function also updates the file with the new content.
 *
 * @param functionFilePath file path of the function file
 * @param originalFileContents the (original) contents of the file
 * @returns the updated content and a map that maps manifest identifiers to the manifest's js object code.
 */
async function extractNextJsManifests(
	functionFilePath: string,
	originalFileContents: string
): Promise<{
	manifests: Map<string, string>;
	updatedContents: string;
}> {
	const program = parse(originalFileContents, {
		ecmaVersion: 'latest',
		sourceType: 'module',
	}) as unknown as AST.ProgramKind;

	const manifestStatementInfos = program.body
		.map(extractManifestStatementInfo)
		.filter(Boolean) as ManifestStatementInfo[];

	let updatedContents = originalFileContents;

	const manifests = new Map<string, string>();
	manifestStatementInfos.forEach(({ manifestIdentifier, start, end }) => {
		const originalManifestCode = originalFileContents.slice(start, end);
		updatedContents = `${`import ${manifestIdentifier} from "${'../'.repeat(
			getFunctionNestingLevel(functionFilePath) - 1
		)}../__next-on-pages-dist__/nextjs-manifests/${manifestIdentifier}.js";`}${updatedContents}`;
		updatedContents = updatedContents.replace(
			originalManifestCode,
			`self.${manifestIdentifier}=${manifestIdentifier};`
		);
		const manifestContent = originalManifestCode
			.slice(`self.${manifestIdentifier}=`.length)
			.replace(/;$/, '');
		manifests.set(manifestIdentifier, manifestContent);
	});

	await writeFile(functionFilePath, updatedContents);

	return { manifests, updatedContents };
}

type ManifestStatementInfo = {
	manifestIdentifier: string;
	start: number;
	end: number;
};

/**
 * Extracts statement manifest information (i.e. the manifest identifier and the start and end locations of the statement)
 * from an AST statement representing the following format: "self.MANIFEST_NAME = { MANIFEST_CONTENT }"
 * where MANIFEST_NAME is one of the name of the manifests that Next.js generates and MANIFEST_CONTENT is its content in js object form
 *
 * @param statement the target AST statement
 * @returns information about the manifest statement if it follows the required format, null otherwise
 */
function extractManifestStatementInfo(
	statement: AST.StatementKind
): ManifestStatementInfo | null {
	try {
		assert(statement.type === 'ExpressionStatement');
		assert(statement.expression.type === 'AssignmentExpression');

		assert(statement.expression.left.type === 'MemberExpression');
		assert(statement.expression.left.object.type === 'Identifier');
		assert(statement.expression.left.object.name === 'self');
		assert(statement.expression.left.property.type === 'Identifier');

		const nextJsManifests = [
			'__RSC_SERVER_MANIFEST',
			'__RSC_MANIFEST',
			'__RSC_CSS_MANIFEST',
			'__BUILD_MANIFEST',
			'__REACT_LOADABLE_MANIFEST',
			'__NEXT_FONT_MANIFEST',
		];
		assert(nextJsManifests.includes(statement.expression.left.property.name));

		const { start, end } = statement as unknown as Node;
		return {
			manifestIdentifier: statement.expression.left.property.name,
			start,
			end,
		};
	} catch {
		return null;
	}
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
 * @param originalFunctionContents the original contents of the function's file
 * @param existingWebpackChunks the existing collected webpack chunks (so that we can validate new ones against them)
 *
 * @returns an object containing the extractedWebpackChunks and the function's file content updated so that it imports/requires
 * those chunks
 */
async function extractWebpackChunks(
	originalFunctionContents: string,
	filePath: string,
	existingWebpackChunks: Map<number, string>
): Promise<{
	updatedFunctionContents: string;
	extractedWebpackChunks: Map<number, string>;
	wasmIdentifiers: Map<string, WasmModuleInfo>;
}> {
	const getChunkImport = getChunkImportFn(filePath);

	const webpackChunks = new Map<number, string>();
	const webpackChunksCodeReplaceMap = new Map<string, string>();

	const webpackChunksImports: string[] = [];

	const { wasmIdentifiers, updatedContents } = await extractAndFixWasmRequires(
		filePath,
		originalFunctionContents
	);

	let functionContents = updatedContents;

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

		webpackChunksImports.push(getChunkImport(key));

		webpackChunksCodeReplaceMap.set(
			chunkExpressionCode,
			getChunkIdentifier(key)
		);
	});

	webpackChunksCodeReplaceMap.forEach((newChunkCode, chunkCode) => {
		functionContents = functionContents.replace(chunkCode, newChunkCode);
	});

	return {
		updatedFunctionContents: [...webpackChunksImports, functionContents].join(
			';\n'
		),
		extractedWebpackChunks: webpackChunks,
		wasmIdentifiers,
	};
}

async function buildWebpackChunkFiles(
	webpackChunks: Map<number, string>,
	tmpWebpackDir: string,
	wasmIdentifiers: Map<string, WasmModuleInfo>
) {
	for (const [chunkIdentifier, code] of webpackChunks) {
		const chunkFilePath = join(tmpWebpackDir, `${chunkIdentifier}.js`);
		await mkdir(dirname(chunkFilePath), { recursive: true });
		await build({
			stdin: {
				contents: `export default ${code}`,
			},
			target: 'es2022',
			platform: 'neutral',
			outfile: chunkFilePath,
			bundle: true,
			external: ['node:*'],
			minify: true,
			plugins: [nodeBuiltInModulesPlugin],
		});
		const fileContents = await readFile(chunkFilePath, 'utf8');
		const wasmChunkImports = Array.from(wasmIdentifiers.entries())
			.filter(([identifier]) => fileContents.includes(identifier))
			.map(
				([identifier, { importPath }]) =>
					`import ${identifier} from '..${importPath}';`
			)
			.join('\n');
		await writeFile(chunkFilePath, `${wasmChunkImports}\n${fileContents}`);
	}
}

type ProcessingSetup = {
	outputDir: string;
	functionsDir: string;
	distFunctionsDir: string;
	distWebpackDir: string;
	disableChunksDedup: boolean;
};

export type DirectoryProcessingResults = {
	invalidFunctions: Set<string>;
	functionsMap: Map<string, string>;
	webpackChunks: Map<number, string>;
	prerenderedRoutes: Map<string, PrerenderedFileData>;
	wasmIdentifiers: Map<string, WasmModuleInfo>;
	nextJsManifests: Map<string, string>;
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
	if (
		statement.type !== 'ExpressionStatement' ||
		statement.expression.type !== 'CallExpression' ||
		statement.expression.callee.type !== 'MemberExpression' ||
		statement.expression.callee.property.type !== 'Identifier' ||
		statement.expression.callee.property.name !== 'push' ||
		statement.expression.callee.object.type !== 'AssignmentExpression' ||
		!isSelfWebpackChunk_N_E(statement.expression.callee.object.left) ||
		statement.expression.callee.object.right.type !== 'LogicalExpression' ||
		!isSelfWebpackChunk_N_E(statement.expression.callee.object.right.left) ||
		statement.expression.callee.object.right.right.type !== 'ArrayExpression' ||
		statement.expression.callee.object.right.right.elements.length !== 0 ||
		statement.expression.arguments[0]?.type !== 'ArrayExpression' ||
		statement.expression.arguments[0].elements[1]?.type !== 'ObjectExpression'
	) {
		return [];
	}

	return statement.expression.arguments[0].elements[1].properties.filter(
		p =>
			p.type === 'Property' &&
			p.key.type === 'Literal' &&
			typeof p.key.value === 'number' &&
			p.value.type === 'ArrowFunctionExpression'
	) as AST.PropertyKind[];
}

/**
 * In the Vercel build output we get top level statement such as:
 *   const wasm_fbeb8adedbc833032bda6f13925ba235b8d09114 = require("/wasm/wasm_fbeb8adedbc833032bda6f13925ba235b8d09114.wasm");
 * those identifiers are used in the various chunks, this function checks the provided statement and collects the identifier
 * name and path so that we can tweak it and replace it with a standard esm import and add it to the chunk using it instead.
 *
 * meaning that practically we take the
 *   const wasm_fbeb8adedbc833032bda6f13925ba235b8d09114 = require("/wasm/wasm_fbeb8adedbc833032bda6f13925ba235b8d09114.wasm");
 * from the route js file and add at the top of the chunk files using wasm_fbeb8adedbc833032bda6f13925ba235b8d09114
 * the following import:
 *   import wasm_fbeb8adedbc833032bda6f13925ba235b8d09114 from "../wasm/wasm_fbeb8adedbc833032bda6f13925ba235b8d09114.wasm";
 */
function getWasmIdentifier(
	statement: AST.StatementKind
): RawWasmModuleInfo | null {
	if (
		statement.type !== 'VariableDeclaration' ||
		statement.declarations.length !== 1 ||
		statement.declarations[0]?.type !== 'VariableDeclarator' ||
		statement.declarations[0].id.type !== 'Identifier' ||
		statement.declarations[0].init?.type !== 'CallExpression' ||
		statement.declarations[0].init.callee.type !== 'Identifier' ||
		statement.declarations[0].init.callee.name !== 'require' ||
		statement.declarations[0].init.arguments.length !== 1 ||
		statement.declarations[0].init.arguments[0]?.type !== 'Literal' ||
		typeof statement.declarations[0].init.arguments[0]?.value !== 'string'
	) {
		return null;
	}

	const importPath = statement.declarations[0].init.arguments[0].value;
	const { start, end } = statement as unknown as Node;
	return {
		identifier: statement.declarations[0].id.name,
		importPath,
		start,
		end,
	};
}

/**
 * check whether the provided AST node represents `self.webpackChunk_N_E`
 */
function isSelfWebpackChunk_N_E(expression: AST.NodeKind): boolean {
	return (
		expression.type === 'MemberExpression' &&
		expression.object.type === 'Identifier' &&
		expression.object.name === 'self' &&
		expression.property.type === 'Identifier' &&
		expression.property.name === 'webpackChunk_N_E'
	);
}

function getChunkIdentifier(chunkKey: number): string {
	return `__chunk_${chunkKey}`;
}

function getRelativeNextOnPagesDistPath(functionPath: string): string {
	const functionNestingLevel = getFunctionNestingLevel(functionPath);
	const accountForNestingPath = `../`.repeat(functionNestingLevel);
	return `${accountForNestingPath}__next-on-pages-dist__`;
}

function getChunkImportFn(functionPath: string): (chunkKey: number) => string {
	const relativeChunksPath = `${getRelativeNextOnPagesDistPath(
		functionPath
	)}/chunks`;
	return chunkKey => {
		const chunkIdentifier = getChunkIdentifier(chunkKey);
		const chunkPath = `${relativeChunksPath}/${chunkKey}.js`;
		return `import ${chunkIdentifier} from '${chunkPath}'`;
	};
}

const functionsDir = resolve('.vercel', 'output', 'functions');

function getFunctionNestingLevel(functionPath: string): number {
	let nestingLevel = -1;
	try {
		const relativePath = relative(functionPath, functionsDir);
		nestingLevel = relativePath.split('..').length - 1;
	} catch {
		/* empty */
	}

	if (nestingLevel < 0) {
		throw new Error(
			`Error: could not determine nesting level of the following function: ${functionPath}`
		);
	}

	return nestingLevel;
}

// Chunks can contain `require("node:*")`, this is not allowed and breaks at runtime
// the following fixes this by updating the require to a standard esm import from "node:*"
export const nodeBuiltInModulesPlugin: Plugin = {
	name: 'node:built-in:modules',
	setup(build) {
		build.onResolve({ filter: /^node:/ }, ({ kind, path }) => {
			// this plugin converts `require("node:*")` calls, those are the only ones that
			// need updating (esm imports to "node:*" are totally valid), so here we tag with the
			// node-buffer namespace only imports that are require calls
			return kind === 'require-call'
				? {
						path,
						namespace: 'node-built-in-modules',
				  }
				: undefined;
		});

		// we convert the imports we tagged with the node-built-in-modules namespace so that instead of `require("node:*")`
		// they import from `export * from "node:*";`
		build.onLoad(
			{ filter: /.*/, namespace: 'node-built-in-modules' },
			({ path }) => {
				return {
					contents: `export * from '${path}'`,
					loader: 'js',
				};
			}
		);
	},
};

/**
 * Copies wasm files into the __next-on-pages-dist__/wasm folder which is the location from which
 * function and chunk files import the wasm modules from
 *
 * @param distDir the __next-on-pages-dist__ directory's path
 * @param wasmIdentifiers map containing all the wasm identifiers collected during the build process
 */
async function copyWasmFiles(
	distDir: string,
	wasmIdentifiers: Map<string, WasmModuleInfo>
): Promise<void> {
	const wasmDistDir = join(distDir, 'wasm');
	await mkdir(wasmDistDir);
	for (const { originalFileLocation, identifier } of wasmIdentifiers.values()) {
		const newLocation = join(wasmDistDir, `${identifier}.wasm`);
		await copyFile(originalFileLocation, newLocation);
	}
}

/**
 * Creates js files into the __next-on-pages-dist__/nextjs-manifest folder which export a default
 * value containing a Next.js manifest object
 *
 * @param distDir the __next-on-pages-dist__ directory's path
 * @param manifests map mapping next manifest identifiers to the manifest objects
 */
async function createNextJsManifestFiles(
	distDir: string,
	manifests: Map<string, string>
): Promise<void> {
	const manifestsDistDir = join(distDir, 'nextjs-manifests');
	await mkdir(manifestsDistDir);
	for (const [identifier, manifest] of manifests.entries()) {
		const path = join(manifestsDistDir, `${identifier}.js`);
		await writeFile(path, `export default ${manifest}`);
	}
}
