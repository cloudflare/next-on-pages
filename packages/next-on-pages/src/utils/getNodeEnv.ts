import { cliWarn } from '../cli';

enum NextJsNodeEnv {
	PRODUCTION = 'production',
	DEVELOPMENT = 'development',
	TEST = 'test',
}

export function getNodeEnv(): string {
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
			{ spaced: true },
		);
	}

	return processNodeEnv;
}
