import dedent from 'dedent-tabs';

const allowedNodeEnvs = ['production', 'development', 'test'] as const;

export type NodeEnv = (typeof allowedNodeEnvs)[number];

export type CliOptions = {
	help: boolean;
	watch: boolean;
	skipBuild: boolean;
	experimentalMinify: boolean;
	nodEnv: NodeEnv;
};

/**
 * parses the options provided to the CLI
 *
 * TODO: this should replaced by yargs or similar
 *
 * @returns the provided options
 */
export function getCliOptions(): CliOptions {
	return {
		help: process.argv.includes('--help'),
		watch: process.argv.includes('--watch'),
		skipBuild: process.argv.includes('--skip-build'),
		experimentalMinify: process.argv.includes('--experimental-minify'),
		nodEnv: getNodeEnv(),
	};
}

function getNodeEnv(): NodeEnv {
	const nodeEnvIdx = process.argv.findIndex(arg => arg === '--node-env');
	if (nodeEnvIdx === -1) {
		return 'production';
	}
	const nextArg = process.argv.at(nodeEnvIdx + 1);
	if (!nextArg || nextArg.startsWith('--')) {
		cliError('Error: Provided --node-env option without an argument.');
		process.exit(1);
	}
	const nodeEnv = nextArg as NodeEnv;
	if (!allowedNodeEnvs.includes(nodeEnv)) {
		cliError(
			`Error: Provided --node-env with the wrong argument, the only available options are: ${allowedNodeEnvs.join(
				', '
			)}`
		);
		process.exit(1);
	}
	return nodeEnv;
}

/**
 * Prints the help message that users get when they provide the help option
 *
 * TODO: we should use yargs or similar and get this autogenerated instead
 */
export function printCliHelpMessage(): void {
	cliLog(`
		Usage: npx @cloudflare/next-on-pages [options]

		Options:

		--help:                Shows this help message

		--skip-build:          Doesn't run 'vercel build' automatically


		--node-env:            The NODE_ENV that should be applied to the built worker,
                         the available values are ${allowedNodeEnvs.join(', ')}
                         (default: production)
                         (usage example: \`--node-env development\`)

		--experimental-minify: Attempts to minify the functions of a project (by de-duping webpack chunks)

		--watch:               Automatically rebuilds when the project is edited


		GitHub: https://github.com/cloudflare/next-on-pages
		'Docs: https://developers.cloudflare.com/pages/framework-guides/deploy-a-nextjs-site/
	`);
}

export function cliLog(message: string, fromVercelCli = false): void {
	// eslint-disable-next-line no-console
	console.log(prepareCliMessage(message, fromVercelCli));
}

export function cliError(
	message: string,
	reportIssue = false,
	fromVercelCli = false
): void {
	// eslint-disable-next-line no-console
	console.error(prepareCliMessage(message, fromVercelCli));
	if (reportIssue) {
		cliError(
			'Please report this at https://github.com/cloudflare/next-on-pages/issues.',
			false,
			fromVercelCli
		);
	}
}

export function cliWarn(message: string, fromVercelCli = false): void {
	// eslint-disable-next-line no-console
	console.warn(prepareCliMessage(message, fromVercelCli));
}

/**
 * prepares a message for Cli printing (simple prefixes each line with the appropriate prefix)
 *
 * the function also removes extra indentation on the message allowing us to indent the messages
 * in the code as we please (see https://www.npmjs.com/package/dedent-tabs)
 */
function prepareCliMessage(message: string, fromVercelCli: boolean): string {
	return dedent(message)
		.split('\n')
		.map(line => `${getCliPrefix(fromVercelCli)} ${line}`)
		.join('\n');
}

function getCliPrefix(fromVercelCli: boolean): string {
	return fromVercelCli ? '▲' : '⚡️';
}
