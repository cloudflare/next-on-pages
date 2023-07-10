import { parse } from 'acorn';
import type * as AST from 'ast-types/gen/kinds';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
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
import { collectIdentifiers } from './ast';
import { timer } from './temp';
import { buildFile, getRelativePath } from './build';
import { addLeadingSlash } from '../../utils';

export async function dedupeEdgeFunctions(
	{ edgeFunctions }: CollectedFunctions,
	opts: ProcessVercelFunctionsOpts
): Promise<CollectedFunctionIdentifiers> {
	const collectIdentifiersTimer = timer('collect function identifiers');
	const identifiers = await getFunctionIdentifiers({ edgeFunctions }, opts);
	collectIdentifiersTimer.stop();

	console.log('Wasm:     ', identifiers.identifierMaps.wasm.size);
	console.log('Manifest: ', identifiers.identifierMaps.manifest.size);
	console.log('Webpack:  ', identifiers.identifierMaps.webpack.size);

	const processFunctionIdentifiersTimer = timer('process function identifiers');
	await processFunctionIdentifiers({ edgeFunctions }, identifiers, opts);
	processFunctionIdentifiersTimer.stop();

	return identifiers;
}

async function processFunctionIdentifiers(
	{ edgeFunctions }: Pick<CollectedFunctions, 'edgeFunctions'>,
	{ entrypointsMap, identifierMaps }: CollectedFunctionIdentifiers,
	opts: ProcessVercelFunctionsOpts
) {
	const functionBuildPromises: Promise<void>[] = [];

	const wasmIdentifierKeys = [...identifierMaps.wasm.keys()];

	for (const [path, fnInfo] of edgeFunctions) {
		const { entrypoint, ...file } = await getFunctionFile(path, fnInfo);
		let fileContents = file.contents;

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const identifiers = entrypointsMap
			.get(entrypoint)!
			// sort so that we make replacements from the end of the file to the start
			.sort((a, b) => b.start - a.start);

		const buildIdentifiersPromises: Promise<void>[] = [];
		const importsToPrepend: NewImportInfo[] = [];

		for (const { type, identifier, start, end, importPath } of identifiers) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const identifierInfo = identifierMaps[type].get(identifier)!;

			if (importPath) {
				processImportIdentifier(
					fileContents,
					{ type, identifier, start, end, importPath, info: identifierInfo },
					opts
				);
			} else if (identifierInfo.consumers > 1) {
				// Only dedupe code blocks if there are multiple consumers.
				const { updatedContents, newImport, buildPromise } =
					processCodeBlockIdentifier(
						{ type, identifier, start, end, info: identifierInfo },
						{ fileContents },
						opts
					);

				fileContents = updatedContents;
				if (buildPromise) buildIdentifiersPromises.push(buildPromise);
				if (newImport) importsToPrepend.push(newImport);
			}
		}

		// Wait for any identifiers to be built before building the function's file.
		await Promise.all(buildIdentifiersPromises);

		// TODO: If wasm identifier is used in code block, prepend the import to the identifier's file.

		const { buildPromise } = await buildFunctionFile(
			fnInfo,
			fileContents,
			{ importsToPrepend },
			opts
		);
		functionBuildPromises.push(buildPromise);
	}

	await Promise.all(functionBuildPromises);
}

/**
 * Builds a new file for an Edge function.
 *
 * - Prepends any imports to the function's contents.
 * - Builds the new file to the output directory.
 *
 * @param fnInfo The collected function info.
 * @param fileContents The contents of the function's file.
 * @param importsToPrepend Imports to prepend to the function's file before building.
 * @param opts Options for processing the function.
 * @returns A promise that resolves when the function has been built.
 */
async function buildFunctionFile(
	fnInfo: FunctionInfo,
	fileContents: string,
	{ importsToPrepend }: { importsToPrepend: NewImportInfo[] },
	{ workerJsDir, nopDistDir }: ProcessVercelFunctionsOpts
): Promise<{ buildPromise: Promise<void> }> {
	const newFnLocation = join('functions', `${fnInfo.relativePath}.js`);

	let functionImports = '';
	importsToPrepend.forEach(({ key, path }) => {
		const relativeImportPath = getRelativePath(newFnLocation, nopDistDir);
		const importPath = join(relativeImportPath, addLeadingSlash(path));

		functionImports += `import ${key} from '${importPath}';\n`;
	});

	const newFnPath = join(nopDistDir, newFnLocation);
	fnInfo.outputPath = relative(workerJsDir, newFnPath);

	const finalFileContents = `${functionImports}${fileContents}`;
	const buildPromise = buildFile(finalFileContents, newFnPath, nopDistDir);

	return { buildPromise };
}

/**
 * Processes an import path identifier.
 *
 * - Moves the imported file to the new location if it doesn't exist.
 * - Updates the file contents to import from the new location.
 *
 * @param fileContents Contents of the function's file.
 * @param ident The import path identifier to process.
 * @param opts Options for processing the function.
 * @returns // TODO
 */
function processImportIdentifier(
	fileContents: string,
	ident: RawIdentifierWithImport<IdentifierType> & { info: IdentifierInfo },
	{ nopDistDir, workerJsDir }: ProcessVercelFunctionsOpts
) {
	// TODO: Move imported asset.
	// TODO: Update file contents to import from new location.
}

/**
 * Processes a code block identifier.
 *
 * - Creates a new file for the code block if it doesn't exist.
 * - Updates the file contents to be able to import the code block.
 *
 * @param fileContents Contents of the function's file.
 * @param ident The code block identifier to process.
 * @param opts Options for processing the function.
 * @returns A promise that resolves when the code block is built, and the new import info to prepend
 * to the function's file.
 */
function processCodeBlockIdentifier(
	ident: RawIdentifier<IdentifierType> & { info: IdentifierInfo },
	{ fileContents }: { fileContents: string },
	{ nopDistDir, workerJsDir }: ProcessVercelFunctionsOpts
): {
	updatedContents: string;
	buildPromise?: Promise<void>;
	newImport?: NewImportInfo;
} {
	const { type, identifier, start, end, info } = ident;
	let updatedContents = fileContents;

	const codeBlock = updatedContents.slice(start, end);

	let buildPromise: Promise<void> | undefined;
	let newImport: NewImportInfo | undefined;

	if (!info.newDest) {
		const newPath = join(nopDistDir, type, `${identifier}.js`);
		info.newDest = relative(workerJsDir, newPath);

		// TODO: Wasm identifier used in code block.

		buildPromise = buildFile(`export default ${codeBlock}`, newPath);
	}

	if (type === 'webpack') {
		const newVal = `__chunk_${identifier}`;
		updatedContents = replaceLastInstance(updatedContents, codeBlock, newVal);
		newImport = { key: newVal, path: info.newDest };
	} else if (type === 'manifest') {
		const newVal = `self.${identifier}=${identifier};`;
		updatedContents = replaceLastInstance(updatedContents, codeBlock, newVal);
		newImport = { key: identifier, path: info.newDest };
	}

	return { updatedContents, newImport, buildPromise };
}

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
	{ disableChunksDedup }: ProcessVercelFunctionsOpts
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
			program,
			{ disableChunksDedup }
		);
	}

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
 * Gets the function file contents and entrypoint.
 *
 * @param path Path to the function directory.
 * @param fnInfo The collected function info.
 * @returns The function file contents and entrypoint.
 */
async function getFunctionFile(
	path: string,
	fnInfo: FunctionInfo
): Promise<{ contents: string; entrypoint: string }> {
	const entrypoint = join(path, fnInfo.config.entrypoint);

	const fileContents = await readFile(entrypoint, 'utf8');
	const fixedContents = fixFunctionContents(fileContents);

	return { contents: fixedContents, entrypoint };
}

/**
 * Replaces the last instance of a string, in a string.
 *
 * @param contents Contents of the file to replace the last instance in.
 * @param target The target string to replace.
 * @param value The value to replace the target with.
 * @returns The updated contents.
 */
function replaceLastInstance(contents: string, target: string, value: string) {
	const lastIndex = contents.lastIndexOf(target);

	if (lastIndex === -1) {
		return contents;
	}

	return (
		contents.slice(0, lastIndex) +
		value +
		contents.slice(lastIndex + target.length)
	);
}
