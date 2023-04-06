import { resolve } from 'path';
import {
	addLeadingSlash,
	normalizePath,
	readPathsRecursively,
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
		normalizePath(file.replace(dir, ''))
	);
}

export type ProcessedVercelOutput = {
	vercelConfig: ProcessedVercelConfig;
	functionsMap: ProcessedVercelBuildOutput;
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

	const functionsMap = new Map<string, BuildOutputItem>(
		staticAssets.map(path => [path, { type: 'static' }])
	);

	// NOTE: The middleware manifest output is used temporarily to match routes + dynamic args. It will be replaced with the regular `functionsMap` in the final routing system. (see issue #129)
	hydratedFunctions.forEach(({ matchers, filepath }, key) => {
		functionsMap.set(key, {
			type: 'function',
			entrypoint: filepath,
			// NOTE: Usage of matchers will be removed in the final routing system. (see issue #129)
			matchers,
		});
	});
	hydratedMiddleware.forEach(({ matchers, filepath }, key) => {
		functionsMap.set(key, {
			type: 'function',
			entrypoint: filepath,
			// NOTE: Usage of matchers will be removed in the final routing system. (see issue #129)
			matchers,
		});
	});

	rewriteMiddlewarePaths(
		functionsMap,
		collectMiddlewarePaths(processedConfig.routes.none)
	);

	return {
		vercelConfig: processedConfig,
		functionsMap,
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
		if ('middlewarePath' in route && !!route.middlewarePath) {
			paths.add(route.middlewarePath);
		}
	}

	return paths;
}

/**
 * Rewrite middleware paths in the functions map to match the build output config.
 *
 * Request path names will no longer accidently match middleware functions as the leading slash is
 * removed from the path name for middleware in the build output config.
 *
 * @param functionsMap Map of path names to function entries.
 * @param middlewarePaths Set of middleware paths.
 */
function rewriteMiddlewarePaths(
	functionsMap: Map<string, BuildOutputItem>,
	middlewarePaths: Set<string>
): void {
	for (const middlewarePath of middlewarePaths) {
		const withLeadingSlash = addLeadingSlash(middlewarePath);
		const entry = functionsMap.get(withLeadingSlash);

		if (!entry || entry.type !== 'function') {
			cliWarn(`Middleware path '${middlewarePath}' does not have a function.`);
			continue;
		}

		functionsMap.set(middlewarePath, { ...entry, type: 'middleware' });
		functionsMap.delete(withLeadingSlash);
	}
}
