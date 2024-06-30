import { writeFile } from 'fs/promises';
import { join, relative } from 'path';
import { build } from 'esbuild';
import { tmpdir } from 'os';
import { generateGlobalJs } from './generateGlobalJs';
import type { ProcessedVercelOutput } from './processVercelOutput';
import { getNodeEnv } from '../utils/getNodeEnv';
import { normalizePath } from '../utils';

/**
 * Construct a record for the build output map.
 *
 * @param item The build output item to construct a record for.
 * @param outputDir The output directory.
 * @returns Record for the build output map.
 */
export function constructBuildOutputRecord(
	item: BuildOutputItem,
	outputDir: string,
) {
	if (item.type === 'static') {
		return `{ type: ${JSON.stringify(item.type)} }`;
	}

	if (item.type === 'override') {
		return `{
				type: ${JSON.stringify(item.type)},
				path: ${item.path ? JSON.stringify(item.path) : undefined},
				headers: ${item.headers ? JSON.stringify(item.headers) : undefined}
			}`;
	}

	return `{
				type: ${JSON.stringify(item.type)},
				entrypoint: '${normalizePath(item.entrypoint.replace(outputDir, '')).replace(
					/^\/_worker\.js\/__next-on-pages-dist__\//,
					'./__next-on-pages-dist__/',
				)}'
			}`;
}

export async function buildWorkerFile(
	{ vercelConfig, vercelOutput }: ProcessedVercelOutput,
	{ outputDir, workerJsDir, nopDistDir, templatesDir }: BuildWorkerFileOpts,
	minify: boolean,
): Promise<string> {
	const functionsFile = join(
		tmpdir(),
		`functions-${Math.random().toString(36).slice(2)}.js`,
	);

	await writeFile(
		functionsFile,
		`export const __BUILD_OUTPUT__ = {${[...vercelOutput.entries()]
			.map(
				([name, item]) =>
					`"${name}": ${constructBuildOutputRecord(item, outputDir)}`,
			)
			.join(',')}};`,
	);

	const outputFile = join(workerJsDir, 'index.js');

	await build({
		entryPoints: [join(templatesDir, '_worker.js')],
		banner: {
			js: generateGlobalJs(),
		},
		bundle: true,
		inject: [functionsFile],
		target: 'es2022',
		platform: 'neutral',
		external: ['node:*', './__next-on-pages-dist__/*', 'cloudflare:*'],
		define: {
			__CONFIG__: JSON.stringify(vercelConfig),
			__NODE_ENV__: JSON.stringify(getNodeEnv()),
			__BUILD_METADATA__: JSON.stringify({
				collectedLocales: collectLocales(vercelConfig.routes),
			}),
		},
		outfile: outputFile,
		minify,
	});

	await build({
		entryPoints: [join(templatesDir, 'in-memory-mutex.ts')],
		bundle: false,
		target: 'es2022',
		platform: 'neutral',
		outdir: join(nopDistDir),
		minify,
	});

	await build({
		entryPoints: ['adaptor.ts', 'cache-api.ts', 'kv.ts'].map(fileName =>
			join(templatesDir, 'cache', fileName),
		),
		bundle: false,
		target: 'es2022',
		platform: 'neutral',
		outdir: join(nopDistDir, 'cache'),
		minify,
	});

	return relative('.', outputFile);
}

type BuildWorkerFileOpts = {
	outputDir: string;
	workerJsDir: string;
	nopDistDir: string;
	templatesDir: string;
};

/**
 * Collects all the locales present in the processed Vercel routes
 *
 * @param routes The Vercel routes to collect the locales from
 * @returns an array containing all the found locales (without duplicates)
 */
function collectLocales(routes: ProcessedVercelRoutes): string[] {
	const locales = Object.values(routes)
		.flat()
		.flatMap(source => {
			if (source.locale?.redirect) {
				return Object.keys(source.locale.redirect);
			}
			return [];
		})
		.filter(Boolean);
	return [...new Set(locales)];
}
