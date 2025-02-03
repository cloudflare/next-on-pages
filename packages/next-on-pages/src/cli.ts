import os from 'os';
import dedent from 'dedent-tabs';
import type { ChalkInstance } from 'chalk';
import chalk from 'chalk';
import { join, resolve } from 'path';
import { getPackageManager } from 'package-manager-manager';
import {
	getPackageVersionOrNull,
	nextOnPagesVersion,
	normalizePath,
} from './utils';

import { program, Option } from 'commander';

program
	.description(`@cloudflare/next-on-pages CLI v.${nextOnPagesVersion}`)
	.allowExcessArguments(false)
	.configureHelp({
		commandUsage: () => '@cloudflare/next-on-pages [options]',
	})
	.helpOption(undefined, 'Shows this help message')
	.addHelpText(
		'after',
		'\n' +
			'GitHub: https://github.com/cloudflare/next-on-pages\n' +
			'Docs: https://developers.cloudflare.com/pages/framework-guides/deploy-a-nextjs-site',
	)
	.addOption(
		new Option('-e, --experimental-minify')
			// Old flag that we kept in order not to introduce a breaking change, it is a noop one and should be removed in v2
			.hideHelp(),
	)
	.addOption(
		new Option(
			'-d, --disableChunksDedup',
			'Disables the chunks deduplication (this option is generally useful only for debugging purposes)',
		)
			// We don't currently document the disable chunks flag since we may need to significantly change the deduplication strategy
			// when turbopack is introduces (see https://github.com/cloudflare/next-on-pages/pull/208/files#r1192279816)
			.hideHelp(),
	)
	.option(
		'-s, --skip-build',
		'Skips the application Vercel build process (only runs the @cloudflare/next-on-pages build logic)',
	)
	.option(
		'-m, --disable-worker-minification',
		'Disables the minification of the _worker.js script performed to reduce its javascript size (this option is generally useful only for debugging purposes)',
	)
	.option('-w, --watch', 'Automatically rebuilds when the project is edited')
	.option('-c, --no-color', 'Disables colored console outputs')
	.option(
		'-i, --info',
		'Prints relevant details about the current system which can be used to report bugs',
	)
	.option(
		'-o, --outdir <path>',
		'Sets the directory to output the worker and static assets to',
		join('.vercel', 'output', 'static'),
	)
	.option(
		'--custom-entrypoint <path>',
		'Wrap the generated worker for your application in a custom worker entrypoint',
	)
	.enablePositionalOptions(false)
	.version(
		nextOnPagesVersion,
		'-v, --version',
		'Shows the version of the package',
	);

export type CliOptions = {
	skipBuild?: boolean;
	experimentalMinify?: boolean;
	disableWorkerMinification?: boolean;
	disableChunksDedup?: boolean;
	watch?: boolean;
	noColor?: boolean;
	info?: boolean;
	outdir: string;
	customEntrypoint?: string;
};

export function parseCliArgs(): CliOptions {
	program.parse();
	const args = program.opts<CliOptions>();
	args.outdir = normalizePath(resolve(args.outdir));
	return args;
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
			'Please report this at https://github.com/cloudflare/next-on-pages/issues/',
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
	const pm = await getPackageManager();

	const pmInfo = pm
		? `\n		Package Manager Used: ${pm.name} (${pm.version})\n`
		: '';

	const [vercelVersion, nextVersion] = await Promise.all(
		['vercel', 'next']
			.map(async pkg => (pm ? getPackageVersionOrNull(pm, pkg) : null))
			.filter(Boolean),
	);

	const envInfoMessage = dedent(
		`
		System:
			Platform: ${os.platform()}
			Arch: ${os.arch()}
			Version: ${os.version()}
			CPU: (${os.cpus().length}) ${os.arch()} ${os.cpus()[0]?.model}
			Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB
			Shell: ${process.env.SHELL?.toString() ?? 'Unknown'}` +
			pmInfo +
			`
		Relevant Packages:
			@cloudflare/next-on-pages: ${nextOnPagesVersion}
			vercel: ${vercelVersion ?? 'N/A'}
			next: ${nextVersion ?? 'N/A'}
	`,
	);

	// eslint-disable-next-line no-console
	console.log(`\n${envInfoMessage}\n`);
}
