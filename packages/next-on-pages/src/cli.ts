import os from 'os';
import dedent from 'dedent-tabs';
import { z } from 'zod';
import { argumentParser } from 'zodcli';
import type { ChalkInstance } from 'chalk';
import chalk from 'chalk';
import { join, resolve } from 'path';
import { nextOnPagesVersion, normalizePath } from './utils';
import {
	getBinaryVersion,
	getPackageVersion,
} from './buildApplication/packageManagerUtils';
import { getCurrentPackageManager } from './buildApplication/packageManagerUtils';

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
		disableChunksDedup: flag,
		disableWorkerMinification: flag,
		version: flag,
		noColor: flag,
		info: flag,
		vercelVersion: z.string().optional().default('latest'),
		outdir: z
			.string()
			.optional()
			.default(join('.vercel', 'output', 'static'))
			.transform(path => normalizePath(resolve(path)))
			.refine(
				path => {
					const currentWorkingDirectory = normalizePath(resolve());
					return (
						path.startsWith(currentWorkingDirectory) &&
						path !== currentWorkingDirectory
					);
				},
				{
					message:
						'The output directory should be inside the current working directory',
				},
			),
	})
	.strict();

export type CliOptions = z.infer<typeof cliOptions>;

/**
 * Process an error that occurred when parsing the CLI args.
 *
 * @param error Error to process.
 * @returns An object with the error message and whether to show the help or report messages.
 */
function parseCliError(error: z.ZodError | Error | unknown): {
	msg: string;
	showHelp?: boolean;
	showReport?: boolean;
} {
	if (error instanceof z.ZodError && error.issues.length > 0) {
		const issue = error.issues[0] as z.ZodIssue;

		if (issue.code === 'unrecognized_keys') {
			const unknownKeys = issue.keys;
			const label = `Unknown option${unknownKeys.length === 1 ? '' : 's'}`;

			return {
				msg: `${label}: ${unknownKeys.join(', ')}`,
				showHelp: true,
			};
		}

		if (
			(issue.code === 'custom' || issue.code === 'invalid_type') &&
			issue.path.length
		) {
			const args = issue.path.join(', ');
			const plural = issue.path.length === 1 ? '' : 's';

			return {
				msg: `Error parsing the ${args} argument${plural}.\n${issue.message}`,
			};
		}
	}

	const fallbackMessage = 'Error: Could not parse the provided CLI arguments.';
	return {
		msg: error instanceof Error ? error.message : fallbackMessage,
		showReport: true,
	};
}

/**
 * parses the options provided to the CLI
 *
 * @returns the provided options
 */
export function parseCliArgs() {
	try {
		return argumentParser({
			options: cliOptions,
			aliases: {
				h: 'help',
				v: 'version',
				s: 'skipBuild',
				e: 'experimentalMinify',
				d: 'disableChunksDedup',
				m: 'disableWorkerMinification',
				w: 'watch',
				c: 'noColor',
				i: 'info',
				o: 'outdir',
				vv: 'vercelVersion',
			},
		}).parse(process.argv.slice(2));
	} catch (error) {
		const { msg, showHelp, showReport } = parseCliError(error);

		cliError(msg, { spaced: true, showReport });

		if (showHelp) printCliHelpMessage();

		process.exit(1);
	}
}

/**
 * Prints the help message that users get when they provide the help option
 *
 * Note: this should soon be available by zodcli and not be needed anymore
 */
export function printCliHelpMessage(): void {
	cliLog(`
		Usage: npx @cloudflare/next-on-pages [options]

		Options:

		--help, -h:                         Shows this help message

		--version, -v:                      Shows the version of the package

		--skip-build, -s:                   Doesn't run 'vercel build' automatically
		${
			// We don't currently document the disable chunks flag since we may need to significantly change the deduplication strategy
			// when turbopack is introduces (see https://github.com/cloudflare/next-on-pages/pull/208/files#r1192279816)
			// `--disable-chunks-dedup, -d:         Disables the de-duplication of webpack chunks performed to reduce the output
			//                                 size of the application so that they can be deployed on Cloudflare Pages
			//                                 without hitting the javascript size limit (this option is generally useful only
			//                                 when there are issues with the de-duplication process, to speed up the building process
			//                                 during development or for debugging purposes)`
			''
		}
		--disable-worker-minification, -m:  Disabled the minification of the _worker.js script performed to reduce its javascript
		                                    size (this option is generally useful only for debugging purposes)

		--watch, -w:                        Automatically rebuilds when the project is edited

		--no-color, -c:                     Disable colored output

		--info, -i:                         Prints relevant details about the current system which can be used to report bugs

		--outdir, -o:                       The directory to output the worker and static assets to.

		--vercelVersion, -vv:								Set up your chosen version of vercel lib.

		GitHub: https://github.com/cloudflare/next-on-pages
		Docs: https://developers.cloudflare.com/pages/framework-guides/deploy-a-nextjs-site/
	`);
}

type LogOptions = {
	fromVercelCli?: boolean;
	spaced?: boolean;
	skipDedent?: boolean;
};

export function cliLog(message: string, opts: LogOptions = {}): void {
	// eslint-disable-next-line no-console
	console.log(prepareCliMessage(message, opts));
}

export function cliSuccess(message: string, opts: LogOptions = {}): void {
	// eslint-disable-next-line no-console
	console.log(
		prepareCliMessage(message, { ...opts, styleFormatter: chalk.green }),
	);
}

export function cliError(
	message: string,
	{
		showReport,
		fromVercelCli,
		...opts
	}: LogOptions & { showReport?: boolean } = {},
): void {
	// eslint-disable-next-line no-console
	console.error(
		prepareCliMessage(message, {
			...opts,
			fromVercelCli,
			styleFormatter: chalk.red,
		}),
	);
	if (showReport) {
		cliError(
			'Please report this at https://github.com/cloudflare/next-on-pages/issues.',
			{ fromVercelCli },
		);
	}
}

export function cliWarn(message: string, opts: LogOptions = {}): void {
	// eslint-disable-next-line no-console
	console.warn(
		prepareCliMessage(message, { ...opts, styleFormatter: chalk.yellow }),
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
		styleFormatter,
		spaced,
		skipDedent,
	}: LogOptions & {
		styleFormatter?: ChalkInstance;
	},
): string {
	const prefix = fromVercelCli ? '▲ ' : '⚡️';
	const preparedMessage = (skipDedent ? message : dedent(message))
		.split('\n')
		.map(line => `${prefix} ${styleFormatter ? styleFormatter(line) : line}`)
		.join('\n');

	return spaced ? `\n${preparedMessage}\n` : preparedMessage;
}

export async function printEnvInfo(): Promise<void> {
	const packageManager = await getCurrentPackageManager();

	const [nodeVersion, bunVersion, pnpmVersion, yarnVersion, npmVersion] =
		await Promise.all(
			['node', 'bun', 'pnpm', 'yarn', 'npm'].map(getBinaryVersion),
		);

	const [vercelVersion, nextVersion] = await Promise.all(
		['vercel', 'next'].map(async pkg => getPackageVersion(pkg, packageManager)),
	);

	const envInfoMessage = dedent(`
		System:
			Platform: ${os.platform()}
			Arch: ${os.arch()}
			Version: ${os.version()}
			CPU: (${os.cpus().length}) ${os.arch()} ${os.cpus()[0]?.model}
			Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB
			Shell: ${process.env.SHELL?.toString() ?? 'Unknown'}
		Binaries:
			Node: ${nodeVersion ?? 'N/A'}
			Bun: ${bunVersion ?? 'N/A'}
			pnpm: ${pnpmVersion ?? 'N/A'}
			Yarn: ${yarnVersion ?? 'N/A'}
			npm: ${npmVersion ?? 'N/A'}
		Package Manager Used: ${packageManager}
		Relevant Packages:
			@cloudflare/next-on-pages: ${nextOnPagesVersion}
			vercel: ${vercelVersion ?? 'N/A'}
			next: ${nextVersion ?? 'N/A'}
	`);

	// eslint-disable-next-line no-console
	console.log(`\n${envInfoMessage}\n`);
}
