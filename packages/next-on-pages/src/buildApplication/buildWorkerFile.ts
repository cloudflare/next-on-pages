import { writeFile } from 'fs/promises';
import { join, relative } from 'path';
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
				entrypoint: '${item.entrypoint
					.replace(outputDir, '')
					.replace(
						/^\/_worker\.js\/__next-on-pages-dist__\//,
						'./__next-on-pages-dist__/',
					)}'
			}`;
}

export async function buildWorkerFile(
	{ vercelConfig, vercelOutput }: ProcessedVercelOutput,
	outputDir: string,
	minify: boolean,
) {
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

	const outputFile = join(outputDir, '_worker.js', 'index.js');

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
			__NODE_ENV__: JSON.stringify(getNodeEnv()),
		},
		outfile: outputFile,
		minify,
	});

	cliSuccess(`Generated '${relative('.', outputFile)}'.`);
}
