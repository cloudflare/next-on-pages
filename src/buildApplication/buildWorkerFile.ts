import { writeFile } from 'fs/promises';
import { join } from 'path';
import { build } from 'esbuild';
import { tmpdir } from 'os';
import { cliSuccess } from '../cli';
import type { NextJsConfigs } from './nextJsConfigs';
import { generateGlobalJs } from './generateGlobalJs';
import type { ProcessedVercelOutput } from './processVercelOutput';

/**
 * Construct a record for the build output map.
 *
 * @param item The build output item to construct a record for.
 * @returns Record for the build output map.
 */
function constructBuildOutputRecord(item: BuildOutputItem) {
	return item.type === 'static'
		? `{ type: ${JSON.stringify(item.type)} }`
		: item.type === 'override'
		? `{
				type: ${JSON.stringify(item.type)},
				path: ${item.path ? JSON.stringify(item.path) : undefined},
				contentType: ${item.contentType ? JSON.stringify(item.contentType) : undefined}
			}`
		: `{
				type: ${JSON.stringify(item.type)},
				entrypoint: AsyncLocalStoragePromise.then(() => import('${item.entrypoint}')),
				matchers: ${JSON.stringify(item.matchers)}
			}`;
}

// NOTE: `nextJsConfigs`, and accompanying logic will be removed in the new routing system. (see issue #129)
export async function buildWorkerFile(
	{ vercelConfig, vercelOutput }: ProcessedVercelOutput,
	nextJsConfigs: NextJsConfigs,
	experimentalMinify: boolean
) {
	const functionsFile = join(
		tmpdir(),
		`functions-${Math.random().toString(36).slice(2)}.js`
	);

	await writeFile(
		functionsFile,
		`
		export const AsyncLocalStoragePromise = import('node:async_hooks').then(({ AsyncLocalStorage }) => {
			globalThis.AsyncLocalStorage = AsyncLocalStorage;
		}).catch(() => undefined);

		export const __BUILD_OUTPUT__ = {${[...vercelOutput.entries()]
			.map(([name, item]) => `"${name}": ${constructBuildOutputRecord(item)}`)
			.join(',')}};`
	);

	await build({
		entryPoints: [join(__dirname, '../templates/_worker.js')],
		banner: {
			js: generateGlobalJs(),
		},
		bundle: true,
		inject: [functionsFile],
		target: 'es2022',
		platform: 'neutral',
		external: ['node:async_hooks'],
		define: {
			__CONFIG__: JSON.stringify(vercelConfig),
			__BASE_PATH__: JSON.stringify(nextJsConfigs.basePath ?? ''),
		},
		outfile: '.vercel/output/static/_worker.js',
		minify: experimentalMinify,
	});

	cliSuccess("Generated '.vercel/output/static/_worker.js'.");
}
