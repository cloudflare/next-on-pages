import { writeFile } from 'fs/promises';
import type { Plugin } from 'esbuild';
import { join } from 'path';
import { build } from 'esbuild';
import { tmpdir } from 'os';
import { cliSuccess } from '../cli';
import { generateGlobalJs } from './generateGlobalJs';
import type { ProcessedVercelOutput } from './processVercelOutput';
import { getNodeEnv } from '../utils/getNodeEnv';

/**
 * Construct a record for the build output map.
 *
 * @param item The build output item to construct a record for.
 * @returns Record for the build output map.
 */
export function constructBuildOutputRecord(item: BuildOutputItem) {
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
				entrypoint: import('${item.entrypoint.replace(
					/^\.vercel\/output\/static\/_worker\.js\/__next-on-pages-dist__\//,
					'./__next-on-pages-dist__/'
				)}')
			}`;
}

export async function buildWorkerFile(
	{ vercelConfig, vercelOutput }: ProcessedVercelOutput,
	minify: boolean
) {
	const functionsFile = join(
		tmpdir(),
		`functions-${Math.random().toString(36).slice(2)}.js`
	);

	await writeFile(
		functionsFile,
		`export const __BUILD_OUTPUT__ = {${[...vercelOutput.entries()]
			.map(([name, item]) => `"${name}": ${constructBuildOutputRecord(item)}`)
			.join(',')}};`
	);

	const outputFile = join(
		'.vercel',
		'output',
		'static',
		'_worker.js',
		'index.js'
	);

	await build({
		entryPoints: [join(__dirname, '..', 'templates', '_worker.js')],
		banner: {
			js: generateGlobalJs(),
		},
		bundle: true,
		inject: [functionsFile],
		target: 'es2022',
		platform: 'neutral',
		external: ['node:*', './__next-on-pages-dist__/*'],
		define: {
			__CONFIG__: JSON.stringify(vercelConfig),
			NODE_ENV: JSON.stringify(getNodeEnv()),
		},
		outfile: outputFile,
		minify,
		plugins: [nodeBufferPlugin],
	});

	cliSuccess(`Generated '${outputFile}'.`);
}

// Chunks can contain `require("node:buffer")`, this is not allowed and breaks at runtime
// the following fixes this by updating the require to a standard esm import from node:buffer
const nodeBufferPlugin: Plugin = {
	name: 'node:buffer',
	setup(build) {
		build.onResolve({ filter: /^node:buffer$/ }, ({ kind, path }) => {
			// this plugin converts `require("node:buffer")` calls, those are the only ones that
			// need updating (esm imports to "node:buffer" are totally valid), so here we tag with the
			// node-buffer namespace only imports that are require calls
			return kind === 'require-call'
				? {
						path,
						namespace: 'node-buffer',
				  }
				: undefined;
		});

		// we convert the imports we tagged with the node-buffer namespace so that instead of `require("node:buffer")`
		// they import from `export * from 'node:buffer;'`
		build.onLoad({ filter: /.*/, namespace: 'node-buffer' }, () => ({
			contents: `export * from 'node:buffer'`,
			loader: 'js',
		}));
	},
};
