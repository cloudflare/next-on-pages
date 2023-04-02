import { writeFile } from 'fs/promises';
import { join } from 'path';
import { build } from 'esbuild';
import { tmpdir } from 'os';
import { cliLog, NodeEnv } from '../cli';
import { NextJsConfigs } from './nextJsConfigs';
import { MiddlewareManifestData } from './middlewareManifest';
import { generateGlobalJs } from './buildGlobalContext';

export async function buildWorkerFile(
	{ hydratedMiddleware, hydratedFunctions }: MiddlewareManifestData,
	vercelConfig: VercelConfig,
	nextJsConfigs: NextJsConfigs,
	experimentalMinify: boolean,
	nodeEnv: NodeEnv
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

		export const __FUNCTIONS__ = {${[...hydratedFunctions.entries()]
			.map(
				([name, { matchers, filepath }]) =>
					`"${name}": { matchers: ${JSON.stringify(
						matchers
					)}, entrypoint: AsyncLocalStoragePromise.then(() => import('${filepath}'))}`
			)
			.join(',')}};

		export const __MIDDLEWARE__ = {${[...hydratedMiddleware.entries()]
			.map(
				([name, { matchers, filepath }]) =>
					`"${name}": { matchers: ${JSON.stringify(
						matchers
					)}, entrypoint: AsyncLocalStoragePromise.then(() => import('${filepath}'))}`
			)
			.join(',')}};`
	);

	await build({
		entryPoints: [join(__dirname, '../templates/_worker.js')],
		banner: {
			js: generateGlobalJs(nodeEnv),
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
		minify: !!experimentalMinify,
	});

	cliLog("Generated '.vercel/output/static/_worker.js'.");
}
