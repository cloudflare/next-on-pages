import { relative, resolve } from 'path';
import {
	addLeadingSlash,
	normalizePath,
	readPathsRecursively,
	stripIndexRoute,
	validateDir,
} from '../utils';
import { cliLog, cliWarn } from '../cli';
import type { MiddlewareManifestData } from './middlewareManifest';
import { processVercelConfig } from './getVercelConfig';

/**
 * Extract a list of static assets from the Vercel build output.
 *
 * @returns List of static asset paths.
 */
export async function getVercelStaticAssets(): Promise<string[]> {
	const dir = resolve('.vercel/output/static');
	if (!(await validateDir(dir))) {
		cliLog('No static assets detected.');
		return [];
	}

	return (await readPathsRecursively(dir)).map(file =>
		addLeadingSlash(normalizePath(relative(dir, file)))
	);
}

export type ProcessedVercelOutput = {
	vercelConfig: ProcessedVercelConfig;
	vercelOutput: ProcessedVercelBuildOutput;
};

/**
 * Take the static assets and functions that are read from the file system and turn them into a map
 * that can be consumed by the routing system.
 *
 * @param config Vercel build output config.
 * @param staticAssets List of static asset paths from the file system.
 * @param functionsMap Map of functions from the file system.
 * @returns Processed Vercel build output map.
 */
export function processVercelOutput(
	config: VercelConfig,
	staticAssets: string[],
	{ hydratedMiddleware, hydratedFunctions }: MiddlewareManifestData
): ProcessedVercelOutput {
	const processedConfig = processVercelConfig(config);

	const processedOutput = new Map<string, BuildOutputItem>(
		staticAssets.map(path => [path, { type: 'static' }])
	);

	// NOTE: The middleware manifest output is used temporarily to match routes + dynamic args. It will be replaced with the regular `functionsMap` in the final routing system. (see issue #129)
	hydratedFunctions.forEach(({ matchers, filepath }, key) => {
		processedOutput.set(key, {
			type: 'function',
			entrypoint: filepath,
			// NOTE: Usage of matchers will be removed in the final routing system. (see issue #129)
			matchers,
		});
	});
	hydratedMiddleware.forEach(({ matchers, filepath }, key) => {
		processedOutput.set(key, {
			type: 'function',
			entrypoint: filepath,
			// NOTE: Usage of matchers will be removed in the final routing system. (see issue #129)
			matchers,
		});
	});

	// Apply the overrides from the build output config to the processed output map.
	applyVercelOverrides(processedConfig, processedOutput);

	rewriteMiddlewarePaths(
		processedOutput,
		collectMiddlewarePaths(processedConfig.routes.none)
	);

	return {
		vercelConfig: processedConfig,
		vercelOutput: processedOutput,
	};
}

/**
 * Collect all middleware paths from the Vercel build output config.
 *
 * @param routes Processed routes from the Vercel build output config.
 * @returns Set of middleware paths.
 */
function collectMiddlewarePaths(routes: VercelSource[]): Set<string> {
	const paths = new Set<string>();

	for (const route of routes) {
		if (route.middlewarePath) {
			paths.add(route.middlewarePath);
		}
	}

	return paths;
}

/**
 * Rewrite middleware paths in the functions map to match the build output config.
 *
 * In the build output config, the `middlewarePath` value is used to denote where the entry point
 * for a middleware function is located. This path does not have a leading slash.
 *
 * For matching requests in the routing system, we use the path name from the request and check
 * against the map of functions. The path name from the request will have a leading slash.
 *
 * It might be possible to accidentally call a middleware function if the request path name matches
 * the middleware path name in the functions map, so to avoid accidental calls, and to match the
 * value in the build output config, we remove the leading slash from the key in the map for each
 * middleware path.
 *
 * @param processedOutput Map of path names to function entries.
 * @param middlewarePaths Set of middleware paths.
 */
function rewriteMiddlewarePaths(
	processedOutput: Map<string, BuildOutputItem>,
	middlewarePaths: Set<string>
): void {
	for (const middlewarePath of middlewarePaths) {
		const withLeadingSlash = addLeadingSlash(middlewarePath);
		const entry = processedOutput.get(withLeadingSlash);

		if (entry?.type === 'function') {
			processedOutput.set(middlewarePath, { ...entry, type: 'middleware' });
			processedOutput.delete(withLeadingSlash);
		} else {
			cliWarn(`Middleware path '${middlewarePath}' does not have a function.`);
		}
	}
}

/**
 * Apply the overrides from the Vercel build output config to the processed output map.
 *
 * The overrides are used to override the output of a static asset. This includes the path name it
 * will be served from, and the content type.
 *
 * @example
 * ```
 * // Serve the static file `500.html` from the path `/500` with the content type `text/html`.
 * { '500.html': { path: '500', contentType: 'text/html' } }
 * ```
 *
 * @link https://vercel.com/docs/build-output-api/v3/configuration#overrides
 *
 * @param vercelConfig Processed Vercel build output config.
 * @param vercelOutput Map of path names to function entries.
 */
function applyVercelOverrides(
	{ overrides }: ProcessedVercelConfig,
	vercelOutput: Map<string, BuildOutputItem>
): void {
	if (overrides) {
		for (const [
			rawAssetPath,
			{ path: rawServedPath, contentType },
		] of Object.entries(overrides)) {
			const assetPath = addLeadingSlash(rawAssetPath);
			const servedPath = addLeadingSlash(rawServedPath);

			const newValue: BuildOutputStaticOverride = {
				type: 'override',
				path: assetPath,
				contentType,
			};

			// Update the existing static record to contain the new `contentType` and `assetPath`.
			const existingStaticRecord = vercelOutput.get(assetPath);
			if (existingStaticRecord?.type === 'static') {
				vercelOutput.set(assetPath, newValue);
			}

			// Add the new served path to the map, overriding the existing record if it exists.
			if (servedPath) {
				vercelOutput.set(servedPath, newValue);
			}

			// If the served path is an index route, add a squashed version of the path to the map.
			const strippedServedPath = stripIndexRoute(servedPath);
			if (strippedServedPath !== servedPath) {
				vercelOutput.set(strippedServedPath, newValue);
			}
		}
	}
}
