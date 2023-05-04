import { cliWarn } from '../cli';

/**
 * Generates the javascript content (as a plain string) that deals with the global scope that needs to be
 * added to the built worker.
 *
 * @returns the plain javascript string that should be added at the top of the the _worker.js file
 */
export function generateGlobalJs(): string {
	const nodeEnv = getNodeEnv();

	return `
		import { AsyncLocalStorage } from 'node:async_hooks';
		globalThis.AsyncLocalStorage = AsyncLocalStorage;

		const __ENV_ALS__ = new AsyncLocalStorage();
		__ENV_ALS__['NODE_ENV'] = '${nodeEnv}';

		globalThis.process = {
			env: new Proxy(
				{},
				{
					get: (_, property) => Reflect.get(__ENV_ALS__.getStore(), property),
					set: (_, property, value) => Reflect.set(__ENV_ALS__.getStore(), property, value),
			}),
		};
	`
		.replace(/^\s+/, '')
		.replace(/\n\s+/g, ' ');
}

enum NextJsNodeEnv {
	PRODUCTION = 'production',
	DEVELOPMENT = 'development',
	TEST = 'test',
}

function getNodeEnv(): string {
	const processNodeEnv = process.env.NODE_ENV;

	if (!processNodeEnv) {
		return NextJsNodeEnv.PRODUCTION;
	}

	const nextJsNodeEnvs = Object.values(NextJsNodeEnv);
	if (!(nextJsNodeEnvs as string[]).includes(processNodeEnv)) {
		cliWarn(
			`
			WARNING:
			    The current value of the environment variable NODE_ENV is "${processNodeEnv}",
			    but the supported values are: ${nextJsNodeEnvs
						.map(env => `"${env}"`)
						.join(', ')}.
			    See: https://nextjs.org/docs/basic-features/environment-variables.
		`,
			{ spaced: true }
		);
	}

	return processNodeEnv;
}
