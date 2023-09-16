import { writeFile, mkdir, rm, rmdir } from 'fs/promises';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { join, resolve } from 'path';
import { cliError, cliLog } from '../cli';
import { validateDir, validateFile } from '../utils';
import type { PackageManager } from './packageManagerUtils';
import {
	getCurrentPackageManager,
	getExecStr,
	getPackageManagerInfo,
	getPackageVersion,
	waitForProcessToClose,
} from './packageManagerUtils';

/**
 * Builds the Next.js output via the Vercel CLI
 *
 * This output consists in:
 *  - the .vercel/output directory which we use (which follows the Build Output specs: https://vercel.com/docs/build-output-api/v3#)
 *  - the .next directory which is Next.js specific and not well documented/stable, we currently use it but we shouldn't
 *
 * TODO: once we stop relying on it add an `rm` command at the end of the function to delete the .next directory
 *       to ensure that we won't regress and rely on it anymore
 *
 * Creates a temporary config file when using the Bun package manager so that Vercel knows to use
 * Bun to install and build the project.
 *
 */
export async function buildVercelOutput(): Promise<void> {
	const pm = await getCurrentPackageManager();
	cliLog(`Detected Package Manager: ${pm}\n`);

	cliLog('Preparing project...');
	await generateProjectJsonFileIfNeeded();

	if (pm === 'bun') {
		const vercelVersion = await getPackageVersion('vercel', pm);

		// Vercel introduced proper Bun support in 32.2.1 and 32.2.4 (for monorepos), therefore we require
		// that at least 32.2.4 is installed and log an error if it isn't, as the build will use the wrong
		// package manager otherwise.
		if (vercelVersion && vercelVersion < '32.2.4') {
			cliError('Vercel version must be 32.2.4 or higher for Bun support.');
			process.exit(1);
		}
	}

	cliLog('Project is ready');

	await runVercelBuild(pm);

	const execStr = await getExecStr(pm, 'vercel');
	cliLog(`Completed \`${execStr} vercel build\`.`);
}

/**
 * The Vercel CLI requires the presence of a project.json file, so we create a dummy one just to
 * satisfy Vercel.
 *
 * @returns The path and args for a temporary config file, if one was created.
 */
async function generateProjectJsonFileIfNeeded(): Promise<void> {
	const projectJsonFilePath = join('.vercel', 'project.json');
	if (!(await validateFile(projectJsonFilePath))) {
		const projectJson: VercelProjectJson = {
			projectId: '_',
			orgId: '_',
			settings: { framework: 'nextjs' },
		};

		await mkdir('.vercel', { recursive: true });
		await writeFile(projectJsonFilePath, JSON.stringify(projectJson));
	}
}

type VercelConfigJson = {
	buildCommand?: string;
	installCommand?: string;
	framework?: string;
};

type VercelProjectJson = {
	projectId: string;
	orgId: string;
	settings: VercelConfigJson;
};

async function runVercelBuild(
	pkgMng: PackageManager,
	additionalArgs: string[] = [],
): Promise<void> {
	const { pm, baseCmd } = await getPackageManagerInfo(pkgMng);

	if (pm === 'yarn (classic)') {
		const vercelVersion = await getPackageVersion('vercel', pkgMng);

		if (!vercelVersion) {
			cliLog(
				`vercel dev dependency missing, installing vercel as a dev dependency with '${baseCmd} add vercel -D'...`,
			);

			const installVercel = spawn(baseCmd, ['add', 'vercel', '-D']);

			logVercelProcessOutput(installVercel);

			await waitForProcessToClose(installVercel);

			cliLog('Install completed');
		}
	}

	cliLog('Building project...');

	const vercelBuild = await getVercelBuildChildProcess(pm, additionalArgs);

	logVercelProcessOutput(vercelBuild);

	await waitForProcessToClose(vercelBuild);
}

async function getVercelBuildChildProcess(
	pkgMng: PackageManager,
	additionalArgs: string[] = [],
): Promise<ChildProcessWithoutNullStreams> {
	const { pm, baseCmd, execCmd, execArgs, dlxOrExec } =
		await getPackageManagerInfo(pkgMng);

	let dlxArgs: string[] = [];

	if (dlxOrExec) {
		const vercelPackageIsInstalled = await getPackageVersion('vercel', pm);
		dlxArgs = dlxOrExec(!vercelPackageIsInstalled);
	}

	return spawn(execCmd ?? baseCmd, [
		...dlxArgs,
		...(execArgs ?? []),
		'vercel',
		'build',
		...additionalArgs,
	]);
}

/**
 * Vercel and Next.js generate *private* files for telemetry purposes that are accessible as static assets (`.vercel/output/static/_next/__private/...`).
 *
 * The routing system for the build output *should* prevent these files from being accessible, but if someone were to exclude all static assets in an `_routes.json` file, they would be accessible.
 *
 * We do not need these files, nor do we want to run the risk of them being available. Therefore, we should delete them instead of uploading them to Cloudflare Pages.
 */
export async function deleteNextTelemetryFiles(
	outputDir: string,
): Promise<void> {
	const nextDir = resolve(outputDir, '_next');
	const privateDir = join(nextDir, '__private');

	if (await validateDir(privateDir)) {
		await rm(privateDir, { recursive: true, force: true });

		try {
			// Try to remove the `_next` directory if it's now empty
			await rmdir(nextDir);
		} catch (e) {
			// Ignore error if the directory is not empty
		}
	}
}

/**
 * Logs the output of the Vercel process to the CLI.
 *
 * @param vercelProcess Spawned Vercel process.
 */
function logVercelProcessOutput(
	vercelProcess: ChildProcessWithoutNullStreams,
): void {
	vercelProcess.stdout.on('data', data =>
		cliLog(`\n${data}`, { fromVercelCli: true }),
	);

	vercelProcess.stderr.on('data', data =>
		// here we use cliLog instead of cliError because the Vercel cli
		// currently displays non-error messages in stderr
		// so we just display all Vercel logs as standard logs
		cliLog(`\n${data}`, { fromVercelCli: true }),
	);
}
