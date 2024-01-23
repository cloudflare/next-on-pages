import { build } from 'esbuild';
import { join } from 'path';
import { getNextConfig } from './nextConfig';

/**
 * Builds files needed by the application in order to implement the Next.js suspense caching, these can
 * be either for the custom cache handler provided by the user or the builtin cache handlers.
 *
 * @param nopDistDir path to the dist directory in which the build process saves the output files
 * @param minify flag indicating wether minification should be applied to the cache files
 * @param templatesDir path to the templates directory
 */
export async function buildCacheFiles(
	nopDistDir: string,
	minify: boolean,
	templatesDir: string,
): Promise<void> {
	const outputCacheDir = join(nopDistDir, 'cache');

	const nextConfig = await getNextConfig();

	const cacheHandlerPath = nextConfig?.cacheHandler;

	if (cacheHandlerPath) {
		await buildCustomIncrementalCacheHandler(
			cacheHandlerPath,
			outputCacheDir,
			minify,
		);
	} else {
		await buildBuiltInCacheHandlers(templatesDir, outputCacheDir, minify);
	}
}

/**
 * Builds the file implementing the custom cache handler provided by the user.
 *
 * @param cacheHandlerPath path to the user defined incremental cache handler
 * @param outputCacheDir path to the directory in which to write the file
 * @param minify flag indicating wether minification should be applied to the output file
 */
async function buildCustomIncrementalCacheHandler(
	cacheHandlerPath: string,
	outputCacheDir: string,
	minify: boolean,
): Promise<void> {
	try {
		await build({
			entryPoints: [cacheHandlerPath],
			bundle: true,
			target: 'es2022',
			platform: 'neutral',
			outfile: join(outputCacheDir, 'custom.js'),
			minify,
		});
	} catch {
		throw new Error(
			`Failed to build custom incremental cache handler from the following provided path: ${cacheHandlerPath}`,
		);
	}
}

/**
 * Builds the files implementing the builtin cache handlers.
 *
 * @param templatesDir path to the templates directory (from which the builtin cache files are taken)
 * @param outputCacheDir path to the directory in which to write the files
 * @param minify flag indicating wether minification should be applied to the cache files
 */
async function buildBuiltInCacheHandlers(
	templatesDir: string,
	outputCacheDir: string,
	minify: boolean,
): Promise<void> {
	await build({
		entryPoints: [
			'builtInCacheHandler.ts',
			'workersCacheApiCacheHandler.ts',
			'KVCacheHandler.ts',
		].map(fileName => join(templatesDir, 'cache', fileName)),
		bundle: false,
		target: 'es2022',
		platform: 'neutral',
		outdir: outputCacheDir,
		minify,
	});
}
