import { watch } from 'chokidar';
import pLimit from 'p-limit';
import { cliLog, CliOptions, getCliOptions, printCliHelpMessage } from './cli';
import { buildApplication } from './buildApplication';
import { nextOnPagesVersion } from './utils';

const limit = pLimit(1);

const cliOptions = getCliOptions();
runNextOnPages(cliOptions);

function runNextOnPages(options: CliOptions): void {
	if (options.version) {
		// eslint-disable-next-line no-console -- for the version lets simply print it plainly
		console.log(nextOnPagesVersion);
		return;
	}

	cliLog(`@cloudflare/next-on-pages CLI v.${nextOnPagesVersion}`);

	if (options.help) {
		printCliHelpMessage();
		return;
	}

	if (options.watch) {
		setWatchMode(() => runBuild(options));
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
			'package-lock.json',
			'yarn.lock',
		],
		ignoreInitial: true,
	}).on('all', fn);
}
