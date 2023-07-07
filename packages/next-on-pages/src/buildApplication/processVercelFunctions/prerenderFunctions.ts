import { dirname, join } from 'node:path';
import type { ProcessVercelFunctionsOpts } from '.';
import type { CollectedFunctions } from './configs';
import {
	addLeadingSlash,
	copyFileWithDir,
	getRouteOverrides,
	normalizePath,
	readJsonFile,
	stripFuncExtension,
	validateFile,
} from '../../utils';
import { cliWarn } from '../../cli';

/**
 * Processes the prerendered routes found in the Vercel build output.
 *
 * - Copies the prerendered assets to the output directory.
 * - Creates overrides for the prerendered routes.
 * - Collects the correct headers for the prerendered assets.
 * - Updates the collected functions with the processed route's information.
 *
 * @param functions Collected functions from the Vercel build output.
 * @param opts Options for processing Vercel functions.
 */
export async function processPrerenderFunctions(
	functions: CollectedFunctions,
	opts: ProcessVercelFunctionsOpts
): Promise<void> {
	for (const [path, fnConfig] of functions.prerenderedFunctions) {
		const routeInfo = await validateRoute(path, fnConfig.relativePath, opts);

		if (routeInfo) {
			const { config, originalFile, destFile, destRoute } = routeInfo;
			await copyFileWithDir(originalFile, destFile);

			functions.prerenderedFunctions.set(path, {
				...fnConfig,
				route: {
					path: destRoute,
					headers: config.initialHeaders,
					overrides: getRouteOverrides(destRoute),
				},
			});
		} else {
			functions.invalidFunctions.set(path, fnConfig);
			functions.prerenderedFunctions.delete(path);
		}
	}
}

/**
 * Validates a prerendered route and retrieve its config file, original file path, and new destination.
 *
 * @param fullPath Full path to the prerendered function's directory.
 * @param relativePath Relative path to the prerendered function's directory.
 * @param opts Options for processing Vercel functions.
 * @returns Information for a valid prerendered route, or null if the route is invalid.
 */
async function validateRoute(
	fullPath: string,
	relativePath: string,
	opts: ProcessVercelFunctionsOpts
): Promise<ValidatedRouteInfo | null> {
	const config = await getRouteConfig(fullPath, relativePath);
	if (!config) return null;

	const originalFile = await getRoutePath(config, relativePath, opts);
	if (!originalFile) return null;

	const dest = await getRouteDest(config, relativePath, opts);

	return { config, originalFile, ...dest };
}
type ValidatedRouteInfo = {
	config: VercelPrerenderConfig;
	originalFile: string;
	destFile: string;
	destRoute: string;
};

/**
 * Retrieves a valid prerendered route config.
 *
 * @param fullPath Full path to the prerendered function's directory.
 * @param relativePath Relative path to the prerendered function's directory.
 * @returns A valid prerendered route config, or null if the config is invalid.
 */
async function getRouteConfig(
	fullPath: string,
	relativePath: string
): Promise<VercelPrerenderConfig | null> {
	const configPath = fullPath.replace(/\.func$/, '.prerender-config.json');
	const config = await readJsonFile<VercelPrerenderConfig>(configPath);

	if (
		config?.type?.toLowerCase() !== 'prerender' ||
		config?.fallback?.type?.toLowerCase() !== 'filefsref' ||
		!config?.fallback?.fsPath
	) {
		const relativeName = stripFuncExtension(relativePath);
		cliWarn(`Invalid prerender config for ${relativeName}`);
		return null;
	}

	return config;
}

/**
 * Retrieves the path to the prerendered route, if it exists.
 *
 * @param config Fallback file configuration.
 * @param relativePath Relative path to the prerendered function's directory.
 * @param opts Options for processing Vercel functions.
 * @returns The path to the prerendered route, or null if it does not exist.
 */
async function getRoutePath(
	{ fallback }: VercelPrerenderConfig,
	relativePath: string,
	{ functionsDir }: ProcessVercelFunctionsOpts
): Promise<string | null> {
	const prerenderRoute = join(dirname(relativePath), fallback.fsPath);
	const prerenderFile = join(functionsDir, prerenderRoute);

	// Check the prerendered file exists.
	if (!(await validateFile(prerenderFile))) {
		const normalizedPath = normalizePath(prerenderRoute);
		cliWarn(`Could not find prerendered file for ${normalizedPath}`);
		return null;
	}

	return prerenderFile;
}

/**
 * Retrieves the new destination for the prerendered file, if no file already exists.
 *
 * @example
 * ```ts
 * // index.prerender-fallback.html -> index.html
 * // index.rsc.prerender-fallback.rsc -> index.rsc
 * // favicon.ico.prerender-fallback.body -> favicon.ico
 * // data.json.prerender-fallback.json -> data.json
 * ```
 *
 * @param config Fallback file configuration.
 * @param relativePath Relative path to the prerendered function's directory.
 * @param opts Options for processing Vercel functions.
 * @returns The new destination for the prerendered file, or null if a file already exists.
 */
async function getRouteDest(
	{ fallback }: VercelPrerenderConfig,
	relativePath: string,
	{ outputDir }: ProcessVercelFunctionsOpts
): Promise<{ destFile: string; destRoute: string }> {
	const fixedFileName = fallback.fsPath.replace(
		/\.prerender-fallback(?:\.(?:rsc|body|json))?/gi,
		''
	);
	const destRoute = normalizePath(join(dirname(relativePath), fixedFileName));
	const destFile = join(outputDir, destRoute);

	// Check if a static file already exists at the new location.
	if (await validateFile(destFile)) {
		cliWarn(`Prerendered file already exists for ${destRoute}, overwriting...`);
	}

	return { destFile, destRoute: addLeadingSlash(destRoute) };
}
