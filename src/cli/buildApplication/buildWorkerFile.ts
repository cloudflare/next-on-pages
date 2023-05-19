import { writeFile } from 'fs/promises';
import { join } from 'path';
import { build } from 'esbuild';
import { tmpdir } from 'os';
import { cliSuccess } from '../utils/cli';
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
				entrypoint: '${item.entrypoint.replace(
					/^\.vercel\/output\/static\/_worker\.js\/__next-on-pages-dist__\//,
					'./__next-on-pages-dist__/'
				)}'
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
		entryPoints: [join(__dirname, '..', 'src', 'cli', 'templates', '_worker.js')],
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
			__NODE_ENV__: JSON.stringify(getNodeEnv()),
		},
		outfile: outputFile,
		minify,
	});

	cliSuccess(`Generated '${outputFile}'.`);
}
