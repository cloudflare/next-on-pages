import { writeFile, mkdir, rm, rmdir } from 'fs/promises';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { join, resolve } from 'path';
import { cliLog } from '../cli';
import { readJsonFile, validateDir, validateFile } from '../utils';
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
 */
export async function buildVercelOutput(): Promise<void> {
	const pm = await getCurrentPackageManager();
	cliLog(`Detected Package Manager: ${pm}\n`);

	cliLog('Preparing project...');
	const tempVercelConfig = await generateProjectJsonFileIfNeeded(pm);
	cliLog('Project is ready');

	await runVercelBuild(pm, tempVercelConfig?.additionalArgs);
	if (tempVercelConfig) {
		await rm(tempVercelConfig.tempPath);
	}

	const execStr = await getExecStr(pm, 'vercel');
	cliLog(`Completed \`${execStr} vercel build\`.`);
}

/**
 * The Vercel CLI requires the presence of a project.json file, so we create a dummy one just to
 * satisfy Vercel.
 *
 * Creates a temporary config file when using the Bun package manager so that Vercel knows to use
 * Bun to install and build the project.
 *
 * @returns The path and args for a temporary config file, if one was created.
 */
async function generateProjectJsonFileIfNeeded(
	pm?: PackageManager,
): Promise<{ additionalArgs: string[]; tempPath: string } | undefined> {
	const projectJsonFilePath = join('.vercel', 'project.json');
	if (!(await validateFile(projectJsonFilePath))) {
		await mkdir('.vercel', { recursive: true });
		await writeFile(
			projectJsonFilePath,
			JSON.stringify({ projectId: '_', orgId: '_', settings: {} }),
		);
	}

	// When using the Bun package manager, we need to ensure the Vercel CLI has a config file that
	// tells it to use Bun, since Vercel doesn't support auto-detecting Bun yet.
	if (pm === 'bun') {
		const oldConfigPath = join('vercel.json');
		const originalConfig = await readJsonFile<VercelConfigJson>(oldConfigPath);

		const tempConfigPath = join('.vercel', 'temp-nop-config.json');
		const tempConfig: VercelConfigJson = {
			buildCommand: 'bun run build',
			installCommand: 'bun install',
			framework: 'nextjs',
			// User-defined config values should override the ones we set.
			...originalConfig,
		};

		await writeFile(tempConfigPath, JSON.stringify(tempConfig));

		return {
			additionalArgs: ['--local-config', tempConfigPath],
			tempPath: tempConfigPath,
		};
	}

	return undefined;
}

type VercelConfigJson = {
	buildCommand?: string;
	installCommand?: string;
	framework?: string;
};

async function runVercelBuild(
	pkgMng: PackageManager,
	additionalArgs: string[] = [],
): Promise<void> {
	const { pm, baseCmd } = await getPackageManagerInfo(pkgMng);

	if (pm === 'yarn (classic)') {
		cliLog(
			`Installing vercel as dev dependencies with '${baseCmd} add vercel -D'...`,
		);

		const installVercel = spawn(baseCmd, ['add', 'vercel', '-D']);

		logVercelProcessOutput(installVercel);

		await waitForProcessToClose(installVercel);

		cliLog('Install completed');
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
