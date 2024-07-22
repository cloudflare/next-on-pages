import { dirname, join } from 'node:path';
import type { ProcessVercelFunctionsOpts } from '.';
import type { CollectedFunctions } from './configs';
import {
	addLeadingSlash,
	copyFileWithDir,
	getFileHash,
	getRouteOverrides,
	normalizePath,
	readJsonFile,
	stripFuncExtension,
	validateFile,
} from '../../utils';
import { cliWarn } from '../../cli';

type PrerenderFunctionsOpts = Pick<
	ProcessVercelFunctionsOpts,
	'functionsDir' | 'outputDir'
>;

/**
 * Processes the prerendered routes found in the Vercel build output.
 *
 * - Copies the prerendered assets to the output directory.
 * - Creates overrides for the prerendered routes.
 * - Collects the correct headers for the prerendered assets.
 * - Updates the collected functions with the processed route's information.
 *
 * @param collectedFunctions Collected functions from the Vercel build output.
 * @param opts Options for processing Vercel functions.
 */
export async function processPrerenderFunctions(
	{ invalidFunctions, prerenderedFunctions }: CollectedFunctions,
	opts: PrerenderFunctionsOpts,
): Promise<void> {
	for (const [path, fnInfo] of prerenderedFunctions) {
		const routeInfo = await validateRoute(path, fnInfo.relativePath, opts);

		if (routeInfo) {
			const { config, destRoute } = routeInfo;

			await copyAssetFile({ ...routeInfo, relativeName: destRoute });

			fnInfo.route = {
				path: destRoute,
				headers: config.initialHeaders,
				overrides: getRouteOverrides(destRoute),
			};
			fnInfo.sourcePath = config.sourcePath;
		} else {
			invalidFunctions.set(path, fnInfo);
			prerenderedFunctions.delete(path);
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
	opts: PrerenderFunctionsOpts,
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
	relativePath: string,
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
	{ functionsDir }: PrerenderFunctionsOpts,
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
	{ outputDir }: PrerenderFunctionsOpts,
): Promise<{ destFile: string; destRoute: string }> {
	const fixedFileName = fallback.fsPath.replace(
		/\.prerender-fallback(?:\.(?:rsc|body|json))?/gi,
		'',
	);
	const destRoute = normalizePath(join(dirname(relativePath), fixedFileName));
	const destFile = join(outputDir, destRoute);

	return { destFile, destRoute: addLeadingSlash(destRoute) };
}

/**
 * Copies a given asset to a new location.
 *
 * If an asset already exists and the hash (contents) is different, it will log a warning and
 * overwrite the file.
 *
 * @param asset - Information about the asset's original location, name, and destination.
 */
export async function copyAssetFile({
	originalFile,
	destFile,
	relativeName,
}: CopyAssetFileArgs): Promise<void> {
	const destFileHash = getFileHash(destFile);
	if (!destFileHash) {
		await copyFileWithDir(originalFile, destFile);
		return;
	}

	// We already know the original file exists, so we can safely get its hash.
	const originalFileHash = getFileHash(originalFile) as Buffer;

	if (!originalFileHash.equals(destFileHash)) {
		cliWarn(
			`Asset with different hash exists for ${relativeName}, overwriting...`,
		);
		await copyFileWithDir(originalFile, destFile);
	}
}

type CopyAssetFileArgs = {
	originalFile: string;
	destFile: string;
	relativeName: string;
};
