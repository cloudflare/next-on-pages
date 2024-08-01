import { parse } from 'acorn';
import type * as AST from 'ast-types/gen/kinds';
import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import type { ProcessVercelFunctionsOpts } from '.';
import type { CollectedFunctions, FunctionInfo } from './configs';
import type {
	IdentifierInfo,
	IdentifierType,
	IdentifiersMap,
	ProgramIdentifiers,
	RawIdentifier,
	RawIdentifierWithImport,
} from './ast';
import { collectIdentifiers, groupIdentifiers } from './ast';
import { buildFile, getRelativePathToAncestor } from './build';
import {
	addLeadingSlash,
	copyFileWithDir,
	normalizePath,
	replaceLastSubstringInstance,
	validateFile,
} from '../../utils';
import { copyAssetFile } from './prerenderFunctions';
import { cliError } from '../../cli';

/**
 * Dedupes edge functions that were found in the build output.
 *
 * Collects the following identifiers from the functions' files:
 * - Wasm imports
 * - Webpack chunks
 * - Next.js JSON manifests
 *
 * Dedupes the collected identifiers in each function, and builds/creates new files for the deduped
 * identifiers.
 *
 * Builds the newly deduped code for a function to the output directory.
 *
 * Copies and dedupes any bundled assets for the function to the output directory.
 *
 * @param collectedFunctions Functions collected from the Vercel build output.
 * @param opts Options for processing Vercel functions.
 * @returns The collected function identifiers.
 */
export async function dedupeEdgeFunctions(
	{ edgeFunctions }: CollectedFunctions,
	opts: ProcessVercelFunctionsOpts,
): Promise<CollectedFunctionIdentifiers> {
	const identifiers = await getFunctionIdentifiers({ edgeFunctions }, opts);

	await processFunctionIdentifiers({ edgeFunctions }, identifiers, opts);

	await processBundledAssets({ edgeFunctions }, opts);

	return identifiers;
}

/**
 * Processes the function identifiers collected from the function files.
 *
 * @param collectedFunctions The collected functions from the Vercel build output.
 * @param collectedFunctionIdentifiers Identifiers collected from the functions' files.
 * @param opts Options for processing the functions.
 */
async function processFunctionIdentifiers(
	{ edgeFunctions }: Pick<CollectedFunctions, 'edgeFunctions'>,
	{ entrypointsMap, identifierMaps }: CollectedFunctionIdentifiers,
	opts: ProcessVercelFunctionsOpts,
): Promise<void> {
	// Tracks the promises for building the function files so that we can wait for them all to finish.
	const functionBuildPromises: Promise<void>[] = [];

	const wasmIdentifierKeys = [...identifierMaps.wasm.keys()];

	for (const [path, fnInfo] of edgeFunctions) {
		const { entrypoint, ...file } = await getFunctionFile(path, fnInfo);
		let fileContents = file.contents;

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const identifiers = entrypointsMap
			// We already know that the entrypoint exists in the map.
			.get(entrypoint)!
			// Sort so that we make replacements from the end of the file to the start.
			.sort((a, b) => b.start - a.start);

		// Tracks the paths to the identifier files that need to be built before building the function's file.
		const identifierPathsToBuild = new Set<string>();

		// Tracks the imports to prepend to the final code for the function and identifiers.
		const importsToPrepend: NewImportInfo[] = [];
		const wasmImportsToPrepend = new Map<string, Set<string>>();

		const newFnLocation = join('functions', `${fnInfo.relativePath}.js`);
		const newFnPath = join(opts.nopDistDir, newFnLocation);

		for (const { type, identifier, start, end, importPath } of identifiers) {
			// We already know that the identifier exists in the map.
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const identifierInfo = identifierMaps[type].get(identifier)!;

			if (importPath) {
				// Dedupe and update collected imports.
				const { updatedContents, newImportToPrepend } =
					await processImportIdentifier(
						{ type, identifier, start, end, importPath, info: identifierInfo },
						{
							fileContents,
							entrypoint,
							newFnLocation,
							fnConfig: fnInfo.config,
						},
						opts,
					);

				fileContents = updatedContents;
				importsToPrepend.push(newImportToPrepend);
			} else if (identifierInfo.consumers.length > 1) {
				// Only dedupe code blocks if there are multiple consumers.
				const { updatedContents, newFilePath, newImport, wasmImports } =
					await processCodeBlockIdentifier(
						{ type, identifier, start, end, info: identifierInfo },
						{ fileContents, wasmIdentifierKeys },
						opts,
					);

				fileContents = updatedContents;
				if (newFilePath) identifierPathsToBuild.add(newFilePath);
				if (newImport) importsToPrepend.push(newImport);
				if (wasmImports.length) {
					const newDest = identifierInfo.newDest as string;
					if (!wasmImportsToPrepend.get(newDest)) {
						wasmImportsToPrepend.set(newDest, new Set());
					}
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
					const destImports = wasmImportsToPrepend.get(newDest)!;
					wasmImports.forEach(wasmImport => destImports.add(wasmImport));
				}
			} else if (identifierInfo.consumers.length === 1) {
				// If there is only one consumer, we can leave the code block inlined.

				identifierInfo.inlined = true;

				if (!identifierInfo.byteLength) {
					const buffer = Buffer.from(fileContents.slice(start, end));
					identifierInfo.byteLength = buffer.byteLength;
				}
			}
		}

		// Build the identifier files before building the function's file.
		await Promise.all(
			[...identifierPathsToBuild].map(async path => {
				const fileContents = await functionifyFileContent(path);
				return buildFile(fileContents, path);
			}),
		);

		// If wasm identifier is used in code block, prepend the import to the code block's file.
		await prependWasmImportsToCodeBlocks(
			wasmImportsToPrepend,
			identifierMaps,
			opts,
		);

		// Build the function's file.
		const { buildPromise } = await buildFunctionFile(
			{ fnInfo, fileContents, newFnLocation, newFnPath },
			{ importsToPrepend },
			opts,
		);
		functionBuildPromises.push(buildPromise);
	}

	// Wait for all functions to be built.
	await Promise.all(functionBuildPromises);
}

/**
 * Given a standard ESM file (without imports) it converts it to a function call that returns
 * an object with the various exports set as its fields
 *
 * The function allows us to override global symbols such as `self`, `globalThis` and `global`
 * (which are used as the function's parameter names)
 *
 * @param path the path of the ESM file
 * @returns the converted file content
 */
async function functionifyFileContent(path: string) {
	const originalFileContents = await readFile(path, 'utf8');
	return `
		${
			/* Note: we need to make sure that the named exports object is defined since that is used inside the file */ ''
		}
		const ${namedExportsObjectName} = {};
		export const getNamedExports = ((self, globalThis, global) => { ${originalFileContents} return ${namedExportsObjectName}; });
	`;
}

/**
 * Builds a new file for an Edge function.
 *
 * - Prepends any imports to the function's contents.
 * - Builds the new file to the output directory.
 *
 * @param function The collected function info and file contents.
 * @param importsToPrepend Imports to prepend to the function's file before building.
 * @param opts Options for processing the function.
 * @returns A promise that resolves when the function has been built.
 */
async function buildFunctionFile(
	{ fnInfo, fileContents, newFnLocation, newFnPath }: BuildFunctionFileOpts,
	{ importsToPrepend }: { importsToPrepend: NewImportInfo[] },
	{ workerJsDir, nopDistDir }: ProcessVercelFunctionsOpts,
): Promise<{ buildPromise: Promise<void> }> {
	const functionImports: string[] = [];

	// Group the identifier imports by the keys for each path.
	const groupedImports = importsToPrepend.reduce((acc, { key, path }) => {
		const existing = acc.get(path);
		acc.set(path, existing ? `${existing},${key}` : key);
		return acc;
	}, new Map<string, string>());

	let chunkMapIdx = 0;
	const chunksExportsMap = new Map<string, Set<string>>();

	const relativeImportPath = getRelativePathToAncestor({
		from: newFnLocation,
		relativeTo: nopDistDir,
	});

	groupedImports.forEach((exports, path) => {
		const importPath = normalizePath(
			join(relativeImportPath, addLeadingSlash(path)),
		);

		if (path.endsWith('.wasm')) {
			// if we're dealing with a wasm file there is a single default export to deal with
			const defaultExport = exports;
			// we don't need/want to apply any code transformation for wasm imports
			functionImports.push(`import ${defaultExport} from "${path}"`);
			return;
		}

		const namedExportsId = `getNamedExports_${chunkMapIdx++}`;
		const exportKeys = exports.split(',');
		chunksExportsMap.set(namedExportsId, new Set(exportKeys));
		functionImports.push(
			`import { getNamedExports as ${namedExportsId} } from '${importPath}'`,
		);
	});

	fnInfo.outputPath = relative(workerJsDir, newFnPath);

	const finalFileContents = iifefyFunctionFile(
		fileContents,
		functionImports,
		fnInfo,
		chunksExportsMap,
	);
	const buildPromise = buildFile(finalFileContents, newFnPath, {
		relativeTo: nopDistDir,
	}).then(async () => {
		const { size } = await stat(newFnPath);
		fnInfo.outputByteSize = size;
	});

	return { buildPromise };
}

type BuildFunctionFileOpts = {
	fnInfo: FunctionInfo;
	fileContents: string;
	newFnLocation: string;
	newFnPath: string;
};

/**
 * Given the content of a function file it converts/wraps it into an iife that overrides the function's contents with an iffe call that
 * overrides global symbols with route-specific proxies (for more details see: templates/_worker.js/routesIsolation.ts)
 *
 * @param fileContents the function file's contents
 * @param functionImports the imports that need to be added to the file
 * @param fnInfo the function's information
 * @param chunksExportsMap a map containing getters and chunks identifiers being used by the function
 * @returns the updated/iifefied file content
 */
function iifefyFunctionFile(
	fileContents: string,
	functionImports: string[],
	fnInfo: FunctionInfo,
	chunksExportsMap: Map<string, Set<string>>,
): string {
	const wrappedContent = `
		${
			/* Note: we need to make sure that the named exports object is defined since that is used inside the file */ ''
		}
		const ${namedExportsObjectName} = {};
		export default ((self, globalThis, global) => {
			${fileContents
				// it looks like there can be direct references to _ENTRIES (i.e. `_ENTRIES` instead of `globalThis._ENTRIES` etc...)
				// we have to update all such references otherwise our proxying won't take effect on those
				.replace(/([^.])_ENTRIES/g, '$1globalThis._ENTRIES')
				// the default export needs to become the return value of the iife, which is then re-exported as default
				.replace(/export\s+default\s+/g, 'return ')}
		})(proxy, proxy, proxy);
	`;

	const proxyCall = `const proxy = globalThis.__nextOnPagesRoutesIsolation.getProxyFor('${
		fnInfo.route?.path ?? ''
	}');`;

	const chunksExtraction = [...chunksExportsMap.entries()].flatMap(
		([getNamedExportsId, keys]) => {
			return [
				`const exportsOf${getNamedExportsId} = ${getNamedExportsId}(proxy, proxy, proxy);`,
				...[...keys.keys()].map(
					key => `const ${key} = exportsOf${getNamedExportsId}["${key}"]`,
				),
			];
		},
	);

	return [
		...functionImports,
		proxyCall,
		...chunksExtraction,
		wrappedContent,
	].join(';');
}

/**
 * Prepends Wasm imports to a code block's built file.
 *
 * @param wasmImportsToPrepend The collected Wasm imports in code block files.
 * @param identifierMaps The collected identifiers.
 * @param opts Options for processing the function.
 */
async function prependWasmImportsToCodeBlocks(
	wasmImportsToPrepend: Map<string, Set<string>>,
	identifierMaps: Record<IdentifierType, IdentifiersMap>,
	{ workerJsDir, nopDistDir }: ProcessVercelFunctionsOpts,
) {
	await Promise.all(
		[...wasmImportsToPrepend.entries()].map(
			async ([codeBlockRelativePath, wasmImports]) => {
				const filePath = join(workerJsDir, codeBlockRelativePath);
				const relativeImportPath = getRelativePathToAncestor({
					from: filePath,
					relativeTo: nopDistDir,
				});

				const functionImports: string[] = [];

				for (const identifier of wasmImports) {
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
					const { newDest } = identifierMaps.wasm.get(identifier)!;
					const wasmImportPath = normalizePath(
						join(relativeImportPath, newDest as string),
					);
					functionImports.push(`import ${identifier} from "${wasmImportPath}"`);
				}

				const oldContents = await readFile(filePath);
				await writeFile(
					filePath,
					`${functionImports.join(';')};${oldContents}`,
				);
			},
		),
	);
}

/**
 * Processes an import path identifier.
 *
 * - Moves the imported file to the new location if it doesn't exist.
 * - Updates the file contents to remove the import.
 * - Returns the information for the new import.
 *
 * @param ident The import path identifier to process.
 * @param processOpts Contents of the function's file, the function's entrypoint, and the new path.
 * @param opts Options for processing the function.
 * @returns The updated file contents alongside the new import information.
 */
async function processImportIdentifier(
	ident: RawIdentifierWithImport<IdentifierType> & { info: IdentifierInfo },
	{
		fileContents,
		entrypoint,
		newFnLocation,
		fnConfig,
	}: ProcessImportIdentifierOpts,
	{ nopDistDir, workerJsDir }: ProcessVercelFunctionsOpts,
): Promise<{ updatedContents: string; newImportToPrepend: NewImportInfo }> {
	const { type, identifier, start, end, importPath, info } = ident;
	let updatedContents = fileContents;

	const codeBlock = updatedContents.slice(start, end);

	if (!info.newDest) {
		const importPathWithoutLeadingDots = importPath
			// Remove leading `../`s from import path.
			.replace(/^(\.\.\/)+/, '');
		const importPathWithoutType = importPathWithoutLeadingDots
			// Remove `type` directory from import path if it starts with it.
			.replace(new RegExp(`^/${type}/`), '/');

		const oldPath = join(dirname(entrypoint), importPath);
		const originalFilePath = resolve(
			// The Vercel function config does not use leading slashes in the file path map.
			fnConfig.filePathMap?.[importPathWithoutLeadingDots.replace(/^\//, '')] ??
				oldPath,
		);

		const newPath = join(nopDistDir, type, importPathWithoutType);
		info.newDest = normalizePath(relative(workerJsDir, newPath));

		await copyFileWithDir(originalFilePath, newPath);

		const { size } = await stat(newPath);
		info.byteLength = size;
	}

	const relativeImportPath = getRelativePathToAncestor({
		from: newFnLocation,
		relativeTo: nopDistDir,
	});
	const newImportPath = normalizePath(join(relativeImportPath, info.newDest));

	// let's remove the original import since it will be re-added later when appropriate
	updatedContents = replaceLastSubstringInstance(
		updatedContents,
		codeBlock,
		'',
	);

	return {
		updatedContents,
		newImportToPrepend: {
			key: identifier,
			path: newImportPath,
		},
	};
}

type ProcessImportIdentifierOpts = {
	fileContents: string;
	entrypoint: string;
	newFnLocation: string;
	fnConfig: VercelFunctionConfig;
};

/**
 * Processes a code block identifier.
 *
 * - Creates a new file for the code block if it doesn't exist.
 * - Updates the file contents to be able to import the code block.
 *
 * @param ident The code block identifier to process.
 * @param processOpts Contents of the function's file.
 * @param opts Options for processing the function.
 * @returns The new path for the identifier, and the new import info to prepend to the function's
 * file, along with the updated file contents.
 */
async function processCodeBlockIdentifier(
	ident: RawIdentifier<IdentifierType> & { info: IdentifierInfo },
	{ fileContents, wasmIdentifierKeys }: ProcessCodeBlockIdentifierOpts,
	{ nopDistDir, workerJsDir }: ProcessVercelFunctionsOpts,
): Promise<ProcessCodeBlockIdentifierResult> {
	const { type, identifier, start, end, info } = ident;
	let updatedContents = fileContents;

	const codeBlock = updatedContents.slice(start, end);

	let identifierKey = identifier;
	let newCodeBlock = identifier;

	if (type === 'webpack') {
		identifierKey = `__chunk_${identifier}`;
		newCodeBlock = identifierKey;
	} else if (type === 'manifest') {
		newCodeBlock = `self.${identifier}=${identifier};`;
	}

	let newFilePath: string | undefined;
	const wasmImports: string[] = [];

	if (!info.newDest) {
		const identTypeDir = join(nopDistDir, type);
		newFilePath = join(identTypeDir, `${info.groupedPath ?? identifier}.js`);
		info.newDest = normalizePath(relative(workerJsDir, newFilePath));

		// Record the wasm identifiers used in the code block.
		wasmIdentifierKeys
			.filter(key => codeBlock.includes(key))
			.forEach(key => wasmImports.push(key));

		const buffer = Buffer.from(
			`${namedExportsObjectName}["${identifierKey}"] = ${codeBlock}\n`,
			'utf8',
		);

		info.byteLength = buffer.byteLength;

		await mkdir(identTypeDir, { recursive: true });
		await appendFile(newFilePath, buffer);
	}

	const newImport: NewImportInfo = { key: identifierKey, path: info.newDest };

	updatedContents = replaceLastSubstringInstance(
		updatedContents,
		codeBlock,
		newCodeBlock,
	);

	return { updatedContents, newFilePath, newImport, wasmImports };
}

type ProcessCodeBlockIdentifierOpts = {
	fileContents: string;
	wasmIdentifierKeys: string[];
};

type ProcessCodeBlockIdentifierResult = {
	updatedContents: string;
	newFilePath?: string;
	newImport?: NewImportInfo;
	wasmImports: string[];
};

type NewImportInfo = { key: string; path: string };

/**
 * Gets the identifiers from the collected functions for deduping.
 *
 * @param collectedFunctions Collected functions from the Vercel build output.
 * @param opts The options for the function processing.
 * @returns The collected identifiers.
 */
async function getFunctionIdentifiers(
	{ edgeFunctions }: Pick<CollectedFunctions, 'edgeFunctions'>,
	{ disableChunksDedup }: ProcessVercelFunctionsOpts,
): Promise<CollectedFunctionIdentifiers> {
	const entrypointsMap: Map<string, ProgramIdentifiers> = new Map();
	const identifierMaps: Record<IdentifierType, IdentifiersMap> = {
		wasm: new Map(),
		manifest: new Map(),
		webpack: new Map(),
	};

	for (const [path, fnInfo] of edgeFunctions) {
		const { entrypoint, contents } = await getFunctionFile(path, fnInfo);

		const program = parse(contents, {
			ecmaVersion: 'latest',
			sourceType: 'module',
		}) as unknown as AST.ProgramKind;

		entrypointsMap.set(entrypoint, []);

		collectIdentifiers(
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			{ identifierMaps, programIdentifiers: entrypointsMap.get(entrypoint)! },
			{ program, entrypoint },
			{ disableChunksDedup },
		);
	}

	groupIdentifiers(identifierMaps);

	return { identifierMaps, entrypointsMap };
}

export type CollectedFunctionIdentifiers = {
	entrypointsMap: Map<string, ProgramIdentifiers>;
	identifierMaps: Record<IdentifierType, IdentifiersMap>;
};

/**
 * Fixes the function contents in miscellaneous ways.
 *
 * Note: this function contains hacks which are quite brittle and should be improved ASAP.
 *
 * @param contents the original function's file contents
 * @returns the updated/fixed contents
 */
function fixFunctionContents(contents: string): string {
	contents = contents.replace(
		// TODO: This hack is not good. We should replace this with something less brittle ASAP
		// https://github.com/vercel/next.js/blob/2e7dfca362931be99e34eccec36074ab4a46ffba/packages/next/src/server/web/adapter.ts#L276-L282
		/(Object.defineProperty\(globalThis,\s*"__import_unsupported",\s*{[\s\S]*?configurable:\s*)([^,}]*)(.*}\s*\))/gm,
		'$1true$3',
	);

	// TODO: Investigate alternatives or a real fix. This hack is rather brittle.
	// The workers runtime does not implement certain properties like `mode` or `credentials`.
	// Due to this, we need to replace them with null so that request deduping cache key generation will work.
	// https://github.com/vercel/next.js/blob/canary/packages/next/src/compiled/react/cjs/react.shared-subset.development.js#L198
	contents = contents.replace(
		/(?:(JSON\.stringify\(\[\w+\.method\S+,)\w+\.mode(,\S+,)\w+\.credentials(,\S+,)\w+\.integrity(\]\)))/gm,
		'$1null$2null$3null$4',
	);

	// The workers runtime does not implement `cache` on RequestInit. This is used in Next.js' patched fetch.
	// Due to this, we remove the `cache` property from those that Next.js adds to RequestInit.
	// https://github.com/vercel/next.js/blob/269114b5cc583f0c91e687c1aeb61503ef681b91/packages/next/src/server/lib/patch-fetch.ts#L304
	contents = contents.replace(
		/"cache",("credentials","headers","integrity","keepalive","method","mode","redirect","referrer")/gm,
		'$1',
	);

	// TODO: Remove once https://github.com/vercel/next.js/issues/58265 is fixed.
	// This resolves a critical issue in Next.js 14.0.2 that breaks edge runtime rendering due to the assumption
	// that the the passed internal request is of type `NodeNextRequest` and never `WebNextRequest`.
	contents = contents.replace(
		/;let{originalRequest:([\w$]+)}=([\w$]+)([,;])/gm,
		';let{originalRequest:$1=$2}=$2$3',
	);
	contents = contents.replace(
		/const { originalRequest } = ([\w$]+)([,;])/gm,
		'const { originalRequest = $1 } = $1$3',
	);

	return contents;
}

/**
 * Gets the function file contents and entrypoint.
 *
 * @param path Path to the function directory.
 * @param fnInfo The collected function info.
 * @returns The function file contents and entrypoint.
 */
async function getFunctionFile(
	path: string,
	fnInfo: FunctionInfo,
): Promise<{ contents: string; entrypoint: string }> {
	const entrypoint = join(path, fnInfo.config.entrypoint);

	const fileContents = await readFile(entrypoint, 'utf8');
	const fixedContents = fixFunctionContents(fileContents);

	return { contents: fixedContents, entrypoint };
}

async function processBundledAssets(
	{ edgeFunctions }: Pick<CollectedFunctions, 'edgeFunctions'>,
	{ nopDistDir }: ProcessVercelFunctionsOpts,
): Promise<void> {
	for (const [functionPath, { relativePath, config }] of edgeFunctions) {
		for (const { name, path } of config.assets ?? []) {
			const originalFile = resolve(
				config.filePathMap?.[path] ?? join(functionPath, path),
			);
			const destFile = `${join(nopDistDir, 'assets', name)}.bin`;
			const relativeName = join(relativePath, path);

			const fileExists = await validateFile(originalFile);

			if (!fileExists) {
				cliError(`Could not find bundled asset file: ${originalFile}`);
				process.exit(1);
			}

			await copyAssetFile({ originalFile, destFile, relativeName });
		}
	}
}

/**
 * When performing the various code tweaking we never introduce standard named ESM exports, since those would
 * be invalid anyways since each js file content gets wrapped into a function anyways.
 *
 * Instead of standard named exports we simply set named exports onto an object which gets then returned by the
 * file wrapper function.
 *
 * Example:
 *   when introducing a new export, instead of introducing:
 *   ```
 *   export const a = ...
 *   ```
 *   we introduce something like:
 *   ```
 *   NAMED_EXPORTS_OBJECT["a"] = ...
 *   ```
 *   and make sure that such <NAMED_EXPORTS_OBJECT> object is always declared and returned by the function wrapping the file's contents.
 *
 * This is the name of the object used for such exports.
 */
const namedExportsObjectName = '__next-on-pages-named_exports_object__';
