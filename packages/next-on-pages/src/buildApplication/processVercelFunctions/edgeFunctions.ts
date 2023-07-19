import { join } from 'node:path';
import type { CollectedFunctions } from './configs';
import { formatRoutePath, stripIndexRoute, validateFile } from '../../utils';
import { cliWarn } from '../../cli';

/**
 * Processes the Edge function routes found in the Vercel build output.
 *
 * - Ensures middleware functions have use the correct file for the entrypoint.
 * - Checks edge function entrypoints exists.
 * - Tries to fix invalid functions that have a valid edge function that can be used instead.
 *
 * @param collectedFunctions Collected functions from the Vercel build output.
 */
export async function processEdgeFunctions(
	collectedFunctions: CollectedFunctions,
): Promise<void> {
	const { edgeFunctions, invalidFunctions, ignoredFunctions } =
		collectedFunctions;

	const tempFunctionsMap = new Map<string, string>();
	const foundRscFunctions = new Map<string, string>();

	for (const [path, fnInfo] of edgeFunctions) {
		const { result, finalEntrypoint } = await checkEntrypoint(
			path,
			fnInfo.relativePath,
			fnInfo.config.entrypoint,
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

				if (formattedPathName.endsWith('.rsc')) {
					foundRscFunctions.set(formattedPathName, path);
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

	// Remove any RSC functions that have a valid non-RSC function that can be used instead.
	// NOTE: RSC functions are identical to non-RSC functions, so this is okay.
	// https://github.com/vercel/vercel/blob/fdf86f/packages/next/src/server-build.ts#L1217
	for (const [formattedPath, path] of foundRscFunctions) {
		replaceRscWithNonRsc(collectedFunctions, tempFunctionsMap, {
			formattedPath,
			path,
		});
	}

	await tryToFixInvalidFunctions(collectedFunctions, tempFunctionsMap);
}

/**
 * Checks whether the entrypoint file exists for the function.
 *
 * If the entrypoint file is `middleware.js`, we check whether the compiled `index.js` exists instead.
 *
 * @param fullPath Full path to the function's directory.
 * @param relativePath Relative path to the function's directory.
 * @param entrypoint Function entrypoint file name.
 * @returns Whether the entrypoint is valid, and if the final entrypoint needs to be updated.
 */
async function checkEntrypoint(
	fullPath: string,
	relativePath: string,
	entrypoint: string,
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
				`Detected an invalid middleware function for ${relativePath}. Skipping...`,
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
	collectedFunctions: CollectedFunctions,
	tempFunctionsMap: Map<string, string>,
): Promise<void> {
	const { invalidFunctions } = collectedFunctions;

	if (invalidFunctions.size === 0) {
		return;
	}

	for (const [path, { relativePath }] of invalidFunctions) {
		const formattedPath = formatRoutePath(relativePath);

		if (
			tempFunctionsMap.has(formattedPath) ||
			tempFunctionsMap.has(stripIndexRoute(formattedPath))
		) {
			invalidFunctions.delete(path);
		} else if (formattedPath.endsWith('.rsc')) {
			replaceRscWithNonRsc(collectedFunctions, tempFunctionsMap, {
				formattedPath,
				path,
			});
		}
	}
}

/**
 * Attempts to replace RSC functions with valid non-RSC functions if they exist.
 *
 * NOTE: RSC functions are identical to non-RSC functions, so this is okay.
 * https://github.com/vercel/vercel/blob/main/packages/next/src/server-build.ts#L1193
 *
 * @param collectedFunctions Collected functions from the Vercel build output.
 * @param tempFunctionsMap Temporary map of formatted paths to raw paths.
 * @param paths Path names for the RSC function.
 */
function replaceRscWithNonRsc(
	{ edgeFunctions, invalidFunctions, ignoredFunctions }: CollectedFunctions,
	tempFunctionsMap: Map<string, string>,
	{ formattedPath, path }: { formattedPath: string; path: string },
): void {
	const pathWithoutRsc = formattedPath.replace(/\.rsc$/, '');
	const nonRscFuncPath = tempFunctionsMap.get(pathWithoutRsc);

	if (nonRscFuncPath) {
		const rscFnInfo = edgeFunctions.get(path) || invalidFunctions.get(path);
		const nonRscFnInfo = edgeFunctions.get(nonRscFuncPath);

		if (rscFnInfo && nonRscFnInfo) {
			if (!nonRscFnInfo.route) nonRscFnInfo.route = { path: pathWithoutRsc };
			if (!nonRscFnInfo.route.overrides) nonRscFnInfo.route.overrides = [];
			nonRscFnInfo.route.overrides.push(formattedPath);

			tempFunctionsMap.delete(formattedPath);
			edgeFunctions.delete(path);
			invalidFunctions.delete(path);
			ignoredFunctions.set(path, rscFnInfo);
		}
	}
}
