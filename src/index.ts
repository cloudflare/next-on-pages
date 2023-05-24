import { watch } from 'chokidar';
import pLimit from 'p-limit';
import { CliOptions, cliWarn } from './cli';
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
			} else {
				cliWarn(
					`
					🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧
					                                        DEPRECATION WARNING
					🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧

					  You're using an older unsupported version of @cloudflare/next-on-pages (${nextOnPagesVersion}),
					  the package has moved to stable versions, please update to such as soon as possible to benefit
					  from the improvements and bug fixes introduced.

					  To do so simply install the package latest version, via:
					      \`npm i -D @cloudflare/next-on-pages@latest\`
					      (and equivalents if you use other package managers)
					  and make sure that your build command does not specify a version for the
					  @cloudflare/next-on-pages package (e.g. \`npx @cloudflare/next-on-pages@pre-v1\`),
					  for most projects the build command should simply be:
					      \`npx @cloudflare/next-on-pages\`
					      (and equivalents if you use other package managers)

					  Note that when upgrading to a stable version your application can stop working due to introduced
					  breaking changes, you can see what breaking changes have happened since version ${nextOnPagesVersion} by
					  checking out the package's changelog file at:
					    https://github.com/cloudflare/next-on-pages/blob/main/CHANGELOG.md

					🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧  🛑  🚧
				`,
					{ spaced: true }
				);
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
