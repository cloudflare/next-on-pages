import { watch } from 'chokidar';
import pLimit from 'p-limit';
import { cliLog, CliOptions, getCliOptions, printCliHelpMessage } from './cli';
import { buildApplication } from './buildApplication';

const limit = pLimit(1);

const cliOptions = getCliOptions();
runNextOnPages(cliOptions);

function runNextOnPages(options: CliOptions): void {
	cliLog('@cloudflare/next-on-pages CLI');

	if (options.help) {
		printCliHelpMessage();
		return;
	}

	runBuild(options);

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
