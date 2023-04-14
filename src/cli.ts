import dedent from 'dedent-tabs';
import { z } from 'zod';
import { argumentParser } from 'zodcli';
import chalk, { ChalkInstance } from 'chalk';

// A helper type to handle command line flags. Defaults to false
const flag = z
	.union([
		z.literal('true').transform(() => true),
		z.literal('false').transform(() => false),
		z.null().transform(() => true),
	])
	.default('false');

const cliOptions = z
	.object({
		help: flag,
		watch: flag,
		skipBuild: flag,
		experimentalMinify: flag,
		version: flag,
		noColor: flag,
	})
	.strict();

export type CliOptions = z.infer<typeof cliOptions>;

/**
 * parses the options provided to the CLI
 *
 * @returns the provided options
 */
export function parseCliArgs() {
	return argumentParser({
		options: cliOptions,
		aliases: {
			h: 'help',
			v: 'version',
			s: 'skipBuild',
			e: 'experimentalMinify',
			w: 'watch',
			nc: 'noColor',
		},
	}).parse(process.argv.slice(2));
}

type LogOptions = {
	fromVercelCli?: boolean;
	spaced?: boolean;
};

/**
 * Prints the help message that users get when they provide the help option
 *
 * Note: this should soon be available by zodcli and not be needed anymore
 */
export function printCliHelpMessage(): void {
	cliLog(`
		Usage: npx @cloudflare/next-on-pages [options]

		Options:

		--help, -h:                 Shows this help message

		--version, -v:              Shows the version of the package

		--skip-build, -s:           Doesn't run 'vercel build' automatically


		--experimental-minify, -m:  Attempts to minify the functions of a project (by de-duping webpack chunks)

		--watch, -w:                Automatically rebuilds when the project is edited

		--no-color, -nc:            Disable colored output

		GitHub: https://github.com/cloudflare/next-on-pages
		'Docs: https://developers.cloudflare.com/pages/framework-guides/deploy-a-nextjs-site/
	`);
}

export function cliLog(
	message: string,
	{ fromVercelCli, spaced }: LogOptions = {}
): void {
	// eslint-disable-next-line no-console
	console.log(prepareCliMessage(message, { fromVercelCli, spaced }));
}

export function cliSuccess(
	message: string,
	{ fromVercelCli, spaced }: LogOptions = {}
): void {
	// eslint-disable-next-line no-console
	console.log(
		prepareCliMessage(message, {
			fromVercelCli,
			styleFromater: chalk.green,
			spaced,
		})
	);
}

export function cliError(
	message: string,
	{
		showReport: shouldReport,
		fromVercelCli,
		spaced,
	}: LogOptions & {
		showReport?: boolean;
	} = {}
): void {
	// eslint-disable-next-line no-console
	console.error(
		prepareCliMessage(message, {
			fromVercelCli,
			styleFromater: chalk.red,
			spaced,
		})
	);
	if (shouldReport) {
		cliError(
			'Please report this at https://github.com/cloudflare/next-on-pages/issues.',
			{ fromVercelCli }
		);
	}
}

export function cliWarn(
	message: string,
	{ fromVercelCli, spaced }: LogOptions = {}
): void {
	// eslint-disable-next-line no-console
	console.warn(
		prepareCliMessage(message, {
			fromVercelCli,
			styleFromater: chalk.yellow,
			spaced,
		})
	);
}

/**
 * prepares a message for Cli printing (simple prefixes each line with the appropriate prefix)
 *
 * the function also removes extra indentation on the message allowing us to indent the messages
 * in the code as we please (see https://www.npmjs.com/package/dedent-tabs)
 */
function prepareCliMessage(
	message: string,
	{
		fromVercelCli,
		styleFromater,
		spaced,
	}: LogOptions & {
		styleFromater?: ChalkInstance;
	}
): string {
	const preparedMessage = dedent(message)
		.split('\n')
		.map(
			line =>
				`${getCliPrefix(fromVercelCli)} ${
					styleFromater ? styleFromater(line) : line
				}`
		)
		.join('\n');

	return spaced ? `\n${preparedMessage}\n` : preparedMessage;
}

function getCliPrefix(fromVercelCli: boolean): string {
	return fromVercelCli ? '▲ ' : '⚡️';
}
