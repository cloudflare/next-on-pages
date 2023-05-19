import { cliWarn } from '../utils/cli';
import {
	copyFileWithDir,
	formatRoutePath,
	normalizePath,
	readJsonFile,
	stripIndexRoute,
	validateFile,
} from '../utils';
import { join, relative, resolve } from 'path';

export type VercelPrerenderConfig = {
	type: string;
	sourcePath?: string;
	fallback: { type: string; mode: number; fsPath: string };
	initialHeaders?: Record<string, string>;
};

export type PrerenderedFileData = {
	headers?: Record<string, string>;
	overrides?: string[];
};

/**
 * Retrieves a valid prerendered route config.
 *
 * @param baseDir Base directory for the prerendered routes.
 * @param file Prerendered config file name.
 * @param dirName Directory name to use for the route.
 * @returns A valid prerendered route config, or null if the config is invalid.
 */
async function getRouteConfig(
	baseDir: string,
	file: string,
	dirName: string
): Promise<VercelPrerenderConfig | null> {
	const configPath = join(baseDir, file);
	const config = await readJsonFile<VercelPrerenderConfig>(configPath);

	if (
		config?.type?.toLowerCase() !== 'prerender' ||
		config?.fallback?.type?.toLowerCase() !== 'filefsref' ||
		!config?.fallback?.fsPath
	) {
		const relativeName = normalizePath(join(dirName, file));
		cliWarn(`Invalid prerender config for ${relativeName}`);
		return null;
	}

	return config;
}

/**
 * Retrieves the path to the prerendered route, if it exists.
 *
 * @param config.fallback Fallback file configuration.
 * @param dirName Directory name to use for the route.
 * @param outputDir Vercel build output directory.
 * @returns The path to the prerendered route, or null if it does not exist.
 */
async function getRoutePath(
	{ fallback }: VercelPrerenderConfig,
	dirName: string,
	outputDir: string
): Promise<string | null> {
	const prerenderRoute = normalizePath(join(dirName, fallback.fsPath));
	const prerenderFile = join(outputDir, 'functions', prerenderRoute);

	// Check the prerendered file exists.
	if (!(await validateFile(prerenderFile))) {
		cliWarn(`Could not find prerendered file for ${prerenderRoute}`);
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
 * @param config.fallback Fallback file configuration.
 * @param dirName Directory name to use for the route.
 * @param outputDir Vercel build output directory.
 * @returns The new destination for the prerendered file, or null if a file already exists.
 */
async function getRouteDest(
	{ fallback }: VercelPrerenderConfig,
	dirName: string,
	outputDir: string
): Promise<{ destFile: string; destRoute: string } | null> {
	const destRoute = normalizePath(
		join(
			dirName,
			fallback.fsPath.replace(
				/\.prerender-fallback(?:\.(?:rsc|body|json))?/gi,
				''
			)
		)
	);
	const destFile = join(outputDir, 'static', destRoute);

	// Check if a static file already exists at the new location.
	if (await validateFile(destFile)) {
		cliWarn(`Prerendered file already exists for ${destRoute}`);
		return null;
	}

	return { destFile, destRoute };
}

/**
 * Validates a prerendered route and retrieve its config file, original file path, and new destination.
 *
 * @param baseDir Base directory for the prerendered routes.
 * @param file Prerendered config file name.
 * @param outputDir Vercel build output directory.
 * @returns Information for a valid prerendered route, or null if the route is invalid.
 */
async function validateRoute(baseDir: string, file: string, outputDir: string) {
	const dirName = relative(join(outputDir, 'functions'), baseDir);
	const config = await getRouteConfig(baseDir, file, dirName);
	if (!config) return null;

	const originalFile = await getRoutePath(config, dirName, outputDir);
	if (!originalFile) return null;

	const dest = await getRouteDest(config, dirName, outputDir);
	if (!dest) return null;

	return {
		config,
		originalFile,
		destFile: dest.destFile,
		destRoute: dest.destRoute,
	};
}

/**
 * Creates a list of overrides for a new route.
 *
 * @param newRoute New route to create overrides for.
 * @returns List of overrides for the new route.
 */
function getRouteOverrides(newRoute: string): string[] {
	// Create override entries that might normally be created through the build output config.
	const formattedPathName = normalizePath(formatRoutePath(newRoute));
	const withoutHtmlExt = formattedPathName.replace(/\.html$/, '');
	const strippedIndexRoute = stripIndexRoute(withoutHtmlExt);
	const overrides = new Set(
		[formattedPathName, withoutHtmlExt, strippedIndexRoute].filter(
			route => route !== `/${newRoute}`
		)
	);

	return [...overrides];
}

/**
 * Extracts the prerendered routes from a list of routes, copies the prerendered files to the
 * `.vercel/static/output` directory, and returns a list of non-prerendered routes.
 *
 * Additionally, it creates paths to use for overrides for the routing process, along with the
 * correct headers to apply.
 *
 * @param prerenderedRoutes Map of prerendered files.
 * @param files File paths to check for prerendered routes.
 * @param baseDir Base directory for the routes.
 * @returns List of non-prerendered routes.
 */
export async function fixPrerenderedRoutes(
	prerenderedRoutes: Map<string, PrerenderedFileData>,
	files: string[],
	baseDir: string
): Promise<string[]> {
	const outputDir = resolve('.vercel', 'output');
	const configs = files.filter(file =>
		/.+\.prerender-config\.json$/gi.test(file)
	);

	const validRoutePaths = new Set<string>();

	for (const file of configs) {
		const routeInfo = await validateRoute(baseDir, file, outputDir);
		if (!routeInfo) continue;

		const { config, originalFile, destFile, destRoute } = routeInfo;
		await copyFileWithDir(originalFile, destFile);

		prerenderedRoutes.set(`/${destRoute}`, {
			headers: config.initialHeaders,
			overrides: getRouteOverrides(destRoute),
		});

		const oldFunc = file.replace(/\.prerender-config\.json$/gi, '.func');

		validRoutePaths.add(file); // original config file
		validRoutePaths.add(normalizePath(relative(baseDir, originalFile))); // original static file
		validRoutePaths.add(oldFunc); // original function directory
	}

	// Remove files related to the prerendered routes from the functions list.
	const functionFiles = files.filter(file => !validRoutePaths.has(file));

	return functionFiles;
}
