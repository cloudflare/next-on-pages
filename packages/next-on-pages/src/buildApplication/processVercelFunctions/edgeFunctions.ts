import { join } from 'node:path';
import type { CollectedFunctions } from './configs';
import { formatRoutePath, stripIndexRoute, validateFile } from '../../utils';
import { cliWarn } from '../../cli';

/**
 * Processes the Edge function routes found in the Vercel build output.
 *
 * - Ensure middleware functions have use the correct file for the entrypoint.
 * - Check edge function entrypoints exists.
 * - Try to fix invalid functions that have a valid edge function that can be used instead.
 *
 * @param collectedFunctions Collected functions from the Vercel build output.
 */
export async function processEdgeFunctions({
	edgeFunctions,
	invalidFunctions,
	ignoredFunctions,
}: CollectedFunctions) {
	const tempFunctionsMap = new Map<string, string>();

	for (const [path, fnInfo] of edgeFunctions) {
		const { result, finalEntrypoint } = await checkEntrypoint(
			path,
			fnInfo.relativePath,
			fnInfo.config.entrypoint
		);

		switch (result) {
			case 'valid': {
				// update the edge function with the final entrypoint if it changed
				if (finalEntrypoint !== fnInfo.config.entrypoint) {
					fnInfo.config.entrypoint = finalEntrypoint;
				}

				const formattedPathName = formatRoutePath(fnInfo.relativePath);

				tempFunctionsMap.set(formattedPathName, path);
				if (formattedPathName.endsWith('/index')) {
					// strip `/index` from the path name as the build output config doesn't rewrite `/index` to `/`
					tempFunctionsMap.set(stripIndexRoute(formattedPathName), path);
				}
				break;
			}
			case 'invalid': {
				invalidFunctions.set(path, fnInfo);
				edgeFunctions.delete(path);
				break;
			}
			case 'ignore': {
				ignoredFunctions.set(path, fnInfo);
				edgeFunctions.delete(path);
				break;
			}
		}
	}

	await tryToFixInvalidFunctions(
		{ edgeFunctions, invalidFunctions },
		tempFunctionsMap
	);
}

/**
 * Checks whether the entrypoint file exists for the function.
 *
 * If the entrypoint file is `middleware.js`, we check whether the compiled `index.js` exists instead.
 *
 * @param fullPath Full path to the function's directory.
 * @param relativePath Relative path to the function's directory.
 * @param entrypoint Function entrypoint file name.
 * @returns
 */
async function checkEntrypoint(
	fullPath: string,
	relativePath: string,
	entrypoint: string
): Promise<
	| { result: 'ignore' | 'invalid'; finalEntrypoint?: never }
	| { result: 'valid'; finalEntrypoint: string }
> {
	let finalEntrypoint = entrypoint;

	// There are instances where the build output will generate an uncompiled `middleware.js` file that is used as the entrypoint.
	// TODO: investigate when and where the file is generated.
	// This file is not able to be used as it is uncompiled, so we try to instead use the compiled `index.js` if it exists.
	let isMiddleware = false;
	if (finalEntrypoint === 'middleware.js') {
		isMiddleware = true;
		finalEntrypoint = 'index.js';
	}

	if (!(await validateFile(join(fullPath, finalEntrypoint)))) {
		if (isMiddleware) {
			// We sometimes encounter an uncompiled `middleware.js` with no compiled `index.js` outside of a base path.
			// Outside the base path, it should not be utilised, so it should be safe to ignore the function.
			cliWarn(
				`Detected an invalid middleware function for ${relativePath}. Skipping...`
			);
			return { result: 'ignore' };
		}

		return { result: 'invalid' };
	}

	return { result: 'valid', finalEntrypoint };
}

/**
 * Process the invalid functions and check whether any valid function was created in the functions
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
 * @param collectedFunctions Collected functions from the Vercel build output.
 * @param tempFunctionsMap Temporary map of functions to check against.
 */
async function tryToFixInvalidFunctions(
	{
		edgeFunctions,
		invalidFunctions,
	}: Pick<CollectedFunctions, 'invalidFunctions' | 'edgeFunctions'>,
	tempFunctionsMap: Map<string, string>
): Promise<void> {
	if (invalidFunctions.size === 0) {
		return;
	}

	for (const [rawPath, { relativePath }] of invalidFunctions) {
		const formattedPath = formatRoutePath(relativePath);

		if (
			tempFunctionsMap.has(formattedPath) ||
			tempFunctionsMap.has(stripIndexRoute(formattedPath))
		) {
			invalidFunctions.delete(rawPath);
		} else if (formattedPath.endsWith('.rsc')) {
			const pathWithoutRsc = formattedPath.replace(/\.rsc$/, '');
			const fullPath = tempFunctionsMap.get(pathWithoutRsc);

			if (fullPath) {
				const edgeFnInfo = edgeFunctions.get(fullPath);
				if (edgeFnInfo) {
					if (!edgeFnInfo.route) edgeFnInfo.route = { path: formattedPath };
					if (!edgeFnInfo.route.overrides) edgeFnInfo.route.overrides = [];
					edgeFnInfo.route.overrides.push(formattedPath);

					invalidFunctions.delete(rawPath);
				}
			}
		}
	}
}
