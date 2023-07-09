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
	{ workerJsDir, nopDistDir }: ProcessVercelFunctionsOpts
) {
	const buildFunctionPromises: Promise<void>[] = [];

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
		const importsToPrepend: { key: string; path: string }[] = [];

		for (const ident of identifiers) {
			const { type, identifier, importPath } = ident;

			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const identInfo = identifierMaps[type].get(identifier)!;

			// TODO: Refactor this ugly chonky function.

			// Only dedupe if there are multiple consumers.
			if (identInfo.consumers > 1) {
				if (importPath) {
					// TODO: Import replacements + file moving.
				} else {
					const codeBlock = fileContents.slice(ident.start, ident.end);
					if (!identInfo.newDest) {
						const newPath = join(nopDistDir, type, `${identifier}.js`);
						identInfo.newDest = relative(workerJsDir, newPath);

						// TODO: Wasm in chunk.

						buildIdentifiersPromises.push(
							buildFile(`export default ${codeBlock}`, newPath)
						);
					}

					if (type === 'webpack') {
						const newVal = `__chunk_${identifier}`;
						fileContents = replaceLastInstance(fileContents, codeBlock, newVal);
						importsToPrepend.push({ key: newVal, path: identInfo.newDest });
					} else if (type === 'manifest') {
						const newVal = `self.${identifier}=${identifier};`;
						fileContents = replaceLastInstance(fileContents, codeBlock, newVal);
						importsToPrepend.push({ key: identifier, path: identInfo.newDest });
					}
				}
			}

			// Return contents and path if a new file should be built.

			// Promise.all to build the new codeBlock files.

			// If wasm identifier is used, prepend the import to the codeblock file.
		}

		// Wait for any identifiers to be built before building the function.
		await Promise.all(buildIdentifiersPromises);

		const newFuncLoc = join('functions', `${fnInfo.relativePath}.js`);
		const newPath = join(nopDistDir, newFuncLoc);

		await Promise.all(
			importsToPrepend.map(async ({ key, path }) => {
				const relativeImportPath = getRelativePath(newFuncLoc, nopDistDir);

				const importPath = join(relativeImportPath, addLeadingSlash(path));
				fileContents = `import ${key} from '${importPath}';\n${fileContents}`;
			})
		);

		// Build the new function contents to the output directory.
		buildFunctionPromises.push(buildFile(fileContents, newPath, nopDistDir));
		fnInfo.outputPath = relative(workerJsDir, newPath);
	}

	await Promise.all(buildFunctionPromises);
}

async function processImportIdentifier(
	{
		ident,
		info,
		nopDistDir,
	}: ProcessIdentifierOpts<RawIdentifierWithImport<IdentifierType>>,
	fileContents: string
): Promise<void> {
	const { type, identifier, importPath } = ident;
	if (!info.newDest) {
		info.newDest = join(nopDistDir, type, `${identifier}.js`);
	}

	// Update the import path in the code to the correct destination.
}

async function processCodeBlockIdentifier(
	{
		ident,
		info,
		nopDistDir,
	}: ProcessIdentifierOpts<RawIdentifier<IdentifierType>>,
	fileContents: string
): Promise<void> {
	const { type, identifier, start, end } = ident;

	const codeBlock = fileContents.slice(start, end);

	if (!info.newDest) {
		info.newDest = join(nopDistDir, type, `${identifier}.js`);

		await buildFile(`export default ${codeBlock}`, info.newDest);
	}

	// Update the code to the import the new file for the code block.
}

type ProcessIdentifierOpts<
	T extends
		| RawIdentifier<IdentifierType>
		| RawIdentifierWithImport<IdentifierType>
> = {
	ident: T;
	info: IdentifierInfo;
	nopDistDir: string;
};

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

async function getFunctionFile(
	path: string,
	fnInfo: FunctionInfo
): Promise<{ contents: string; entrypoint: string }> {
	const entrypoint = join(path, fnInfo.config.entrypoint);

	const fileContents = await readFile(entrypoint, 'utf8');
	const fixedContents = fixFunctionContents(fileContents);

	return { contents: fixedContents, entrypoint };
}

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
