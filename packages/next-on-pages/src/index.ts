import { watch } from 'chokidar';
import pLimit from 'p-limit';
import type { CliOptions } from './cli';
import { cliWarn, cliError } from './cli';
import { cliLog, parseCliArgs, printCliHelpMessage, printEnvInfo } from './cli';
import { buildApplication } from './buildApplication';
import { isWindows, nextOnPagesVersion } from './utils';

const limit = pLimit(1);

void runNextOnPages();

async function runNextOnPages(): Promise<void> {
	const args = parseCliArgs();

	if (args.version) {
		// eslint-disable-next-line no-console -- for the version lets simply print it plainly
		console.log(nextOnPagesVersion);
		return;
	}
	if (args.info) {
		await printEnvInfo();
		return;
	}

	cliLog(`@cloudflare/next-on-pages CLI v.${nextOnPagesVersion}`);

	if (args.help) {
		printCliHelpMessage();
		return;
	}

	if (isWindows()) {
		cliWarn(
			`Warning: It seems like you're on a Windows system, the Vercel CLI (run by @cloudflare/next-on-pages
			to build your application) seems not to work reliably on Windows so if you experience issues during
			the build process please try switching to a different operating system or running
			@cloudflare/next-on-pages under the Windows Subsystem for Linux`,
			{ spaced: true },
		);
	}

	if (args.experimentalMinify) {
		cliWarn(
			`
			Warning: the --experimental-minify|-e flag is deprecated and doesn't produce any effect, the
			(previously named) experimental minification is now enabled by default.

			Note: if you're using the --experimental-minify|-e flag in your build command please remove it
			      as it will be removed in a future version of the package (causing your command to fail).
		`,
			{ spaced: true },
		);
	}

	// Run the build once
	runBuild(args);

	// If the watch flag is set, run in watch mode
	if (args.watch) {
		setWatchMode(() => runBuild(args));
	}
}

function runBuild(options: CliOptions) {
	limit(async () => {
		if (limit.pendingCount === 0) {
			await buildApplication(options);
			if (options.watch) {
				cliLog(`
					Running in '--watch' mode. Awaiting changes... (Ctrl+C to exit.)"
				`);
			}
		}
	}).catch(error => {
		const errorMessage =
			error instanceof Error ? error.message : JSON.stringify(error);
		cliError(`Unexpected error: ${errorMessage}`);
	});
}

function setWatchMode(fn: () => void): void {
	watch('.', {
		ignored: [
			'.git',
			'node_modules',
			'.vercel',
			'.next',
			'.wrangler',
			'package-lock.json',
			'yarn.lock',
			'pnpm-lock.yaml',
			'.pnpm-store',
			'_tmp_*',
			'package.json',
		],
		ignoreInitial: true,
	}).on('change', fn);
}
