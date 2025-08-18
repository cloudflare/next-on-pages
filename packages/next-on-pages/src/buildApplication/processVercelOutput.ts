import { dirname, join, relative, resolve } from 'path';
import { copyFile, mkdir, rm } from 'fs/promises';
import {
	addLeadingSlash,
	normalizePath,
	readPathsRecursively,
	stripFuncExtension,
	stripIndexRoute,
	validateDir,
} from '../utils';
import { cliError, cliLog, cliWarn } from '../cli';
import { processVercelConfig } from './getVercelConfig';
import { deleteNextTelemetryFiles } from './buildVercelOutput';
import type { FunctionInfo } from './processVercelFunctions/configs';

/**
 * Extracts a list of static assets from the Vercel build output.
 *
 * Purges the Next.js telemetry files from the static assets at the same time.
 *
 * @returns List of static asset paths.
 */
export async function getVercelStaticAssets(): Promise<string[]> {
	const dir = resolve('.vercel', 'output', 'static');
	if (!(await validateDir(dir))) {
		cliLog('No static assets detected.');
		return [];
	}

	await deleteNextTelemetryFiles(dir);

	return (
		(await readPathsRecursively(dir))
			.map(file => addLeadingSlash(normalizePath(relative(dir, file))))
			// Filter out the worker script output directory and NOP-generated files as those are not valid static assets.
			.filter(
				path =>
					!/^\/_worker\.js\//.test(path) &&
					!['/_headers', '/_routes.json'].includes(path),
			)
	);
}

/**
 * Copies the static assets from the default Vercel output directory to the custom output directory.
 *
 * @param vercelDir Default Vercel output directory.
 * @param outputDir Output directory to copy static assets to.
 * @param staticAssets List of static asset paths.
 */
export async function copyVercelStaticAssets(
	vercelDir: string,
	outputDir: string,
	staticAssets: string[],
): Promise<void> {
	if (staticAssets.length === 0) return;
	const plural = staticAssets.length > 1 ? 's' : '';
	cliLog(
		`Copying ${staticAssets.length} static asset${plural} to output directory...`,
	);

	await Promise.all(
		staticAssets.map(async file => {
			const src = join(vercelDir, file);
			const dest = join(outputDir, file);
			try {
				await mkdir(dirname(dest), { recursive: true });
				await copyFile(src, dest);
			} catch (e) {
				cliError(`Failed to copy static asset '${file}' to output directory.`);
			}
		}),
	);
}

/**
 * Prepares the custom output directory for the worker and static assets.
 *
 * Deletes the custom directory and its contents if it already exists.
 *
 * @param outputDir Custom output directory.
 * @param staticAssets List of static asset paths.
 */
export async function processOutputDir(
	outputDir: string,
	staticAssets: string[],
) {
	const vercelDir = normalizePath(resolve('.vercel', 'output', 'static'));

	// If the output directory is not the default Vercel one, delete it if exists and create a new one.
	// Then, copy the static assets from the default Vercel output directory to the new one.
	if (outputDir !== vercelDir) {
		cliLog(`Using custom output directory: ${relative('.', outputDir)}`);

		await rm(outputDir, { recursive: true, force: true });
		await mkdir(outputDir, { recursive: true });
		await copyVercelStaticAssets(vercelDir, outputDir, staticAssets);
	} else {
		// If the output directory is the default Vercel one, delete the `_worker.js` directory contents.
		await rm(join(outputDir, '_worker.js'), { recursive: true, force: true });
	}
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
 * @param prerenderedRoutes Map of prerendered files from the file system.
 * @param edgeFunctions Map of edge functions from the file system.
 * @returns Processed Vercel build output map.
 */
export function processVercelOutput(
	config: VercelConfig,
	staticAssets: string[],
	prerenderedRoutes = new Map<string, FunctionInfo>(),
	edgeFunctions = new Map<string, FunctionInfo>(),
): ProcessedVercelOutput {
	const processedConfig = processVercelConfig(config);

	const processedOutput = new Map<string, BuildOutputItem>(
		staticAssets.map(path => [path, { type: 'static' }]),
	);

	edgeFunctions.forEach(({ relativePath, outputPath, route }) => {
		processedOutput.set(route?.path ?? stripFuncExtension(relativePath), {
			type: 'function',
			entrypoint: outputPath as string,
		});

		route?.overrides?.forEach(overridenPath => {
			processedOutput.set(overridenPath, {
				type: 'function',
				entrypoint: outputPath as string,
			});
		});
	});

	// Apply the overrides from the build output config to the processed output map.
	applyVercelOverrides(processedConfig, processedOutput);
	// Apply the prerendered routes and their overrides to the processed output map.
	applyPrerenderedRoutes(prerenderedRoutes, processedOutput);

	rewriteMiddlewarePaths(
		processedOutput,
		collectMiddlewarePaths(processedConfig.routes.none),
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
	return new Set(
		routes.map(route => route.middlewarePath ?? '').filter(Boolean),
	);
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
	middlewarePaths: Set<string>,
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
	vercelOutput: Map<string, BuildOutputItem>,
): void {
	Object.entries(overrides ?? []).forEach(
		([rawAssetPath, { path: rawServedPath, contentType }]) => {
			// The Vercel CLI can create some overrides without a specified path, usually for
			// them we default to `/`, this is however problematic for the not-found.txt override
			// which cases requests to `/` all to be redirected to the not found txt file, so we
			// do want to skip those (PS: note that not including a path is not conformant to the
			// build output API specs, so this is undocumented behavior that we deal with in a
			// best effort manner)
			if (!rawServedPath && rawAssetPath === '_next/static/not-found.txt') {
				return;
			}

			const assetPath = addLeadingSlash(rawAssetPath);
			const servedPath = addLeadingSlash(rawServedPath ?? '');

			const newValue: BuildOutputStaticOverride = {
				type: 'override',
				path: assetPath,
				headers: contentType ? { 'content-type': contentType } : undefined,
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
		},
	);
}

/**
 * Apply the prerendered routes and their overrides to the processed output map.
 *
 * @param prerenderedRoutes Prererendered routes to apply to the output map.
 * @param vercelOutput Map of path names to build output items.
 */
function applyPrerenderedRoutes(
	prerenderedRoutes: Map<string, FunctionInfo>,
	vercelOutput: Map<string, BuildOutputItem>,
): void {
	prerenderedRoutes.forEach(({ relativePath, route }) => {
		const path = route?.path ?? stripFuncExtension(relativePath);

		vercelOutput.set(path, {
			type: 'override',
			path,
			headers: route?.headers,
		});

		route?.overrides?.forEach(overridenPath => {
			vercelOutput.set(overridenPath, {
				type: 'override',
				path,
				headers: route?.headers,
			});
		});
	});
}
