import { watch } from 'chokidar';
import pLimit from 'p-limit';
import type { CliOptions } from './cli';
import { cliLog, parseCliArgs, printCliHelpMessage, printEnvInfo } from './cli';
import { buildApplication } from './buildApplication';
import { nextOnPagesVersion } from './utils';

const limit = pLimit(1);

runNextOnPages();

function runNextOnPages(): void {
	const args = parseCliArgs();

	if (args.version) {
		// eslint-disable-next-line no-console -- for the version lets simply print it plainly
		console.log(nextOnPagesVersion);
		return;
	}
	if (args.info) {
		printEnvInfo();
		return;
	}

	cliLog(`@cloudflare/next-on-pages CLI v.${nextOnPagesVersion}`);

	if (args.help) {
		printCliHelpMessage();
		return;
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
		],
		ignoreInitial: true,
	}).on('all', fn);
}
