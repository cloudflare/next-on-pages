import { writeFile } from 'fs/promises';
import { join } from 'path';
import type { Plugin} from 'esbuild';
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

	const outputFile = join('.vercel', 'output', 'static', '_worker.js');

	await build({
		entryPoints: [join(__dirname, '..', 'templates', '_worker.js')],
		banner: {
			js: generateGlobalJs(),
		},
		bundle: true,
		inject: [functionsFile],
		target: 'es2022',
		platform: 'neutral',
		external: ['node:async_hooks', "node:buffer"],
		define: {
			__CONFIG__: JSON.stringify(vercelConfig),
			__BASE_PATH__: JSON.stringify(nextJsConfigs.basePath ?? ''),
		},
		outfile: outputFile,
		minify: experimentalMinify,
		plugins: [nodeBufferPlugin]
	});

	cliSuccess(`Generated '${outputFile}'.`);
}

// Chunks can contain `require("node:buffer")`, this is not allowed and breaks at runtime
// the following fixes this by updating the require to a standard esm import from node:buffer
const nodeBufferPlugin: Plugin = {
	name: 'node:buffer',
	setup(build) {
	  build.onResolve({ filter: /^node:buffer$/ }, args => ({
		path: args.path,
		namespace: 'node-buffer',
	  }))

	  build.onLoad({ filter: /.*/, namespace: 'node-buffer' }, () => ({
		contents: "export * from 'node:buffer'",
		loader: 'js',
	  }))
	},
};
