import { writeFile, mkdir, rm, rmdir } from 'fs/promises';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { join, resolve } from 'path';
import { cliLog, cliWarn } from '../cli';
import { readJsonFile, validateDir, validateFile } from '../utils';
import type { PackageManager } from 'package-manager-manager';
import { waitForProcessToClose } from './processUtils';

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
 * @param pm the package manager currently in use
 */
export async function buildVercelOutput(pm: PackageManager): Promise<void> {
	cliLog(`Detected Package Manager: ${pm.name} (${pm.version})\n`);

	cliLog('Preparing project...');
	await generateProjectJsonFileIfNeeded();

	let tempVercelConfig: TempVercelConfigInfo | undefined;

	if (pm.name === 'bun') {
		// Vercel introduced proper Bun support in 32.2.1 and 32.2.4 (for monorepos), therefore we should
		// ensure the Vercel CLI has a config file telling it to use Bun for older versions. This is done
		// to prevent a breaking change for users who are using an older version of the Vercel CLI.
		const vercelInfo = await pm.getPackageInfo('vercel');
		if (vercelInfo && vercelInfo.version < '32.2.4') {
			cliWarn(
				'Vercel CLI version is < 32.2.4, creating temporary config for Bun support...',
			);
			tempVercelConfig = await createTempVercelConfig({
				buildCommand: 'bun run build',
				installCommand: 'bun install',
			});
		}
	}

	cliLog('Project is ready');

	await runVercelBuild(pm, tempVercelConfig?.additionalArgs);
	if (tempVercelConfig) {
		await rm(tempVercelConfig.tempPath);
	}

	const execStr = await pm.getRunExec('vercel', { args: ['build'] });
	cliLog(`Completed \`${execStr}\`.`);
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

/**
 * Creates a temporary Vercel config file that can be provided to the Vercel CLI to give it
 * additional configuration when building the project.
 *
 * @param config The values to set in the temporary config file.
 * @returns The path and args for the temporary config file.
 */
async function createTempVercelConfig(
	config: Partial<VercelConfigJson>,
): Promise<TempVercelConfigInfo> {
	const oldConfigPath = join('vercel.json');
	const originalConfig = await readJsonFile<VercelConfigJson>(oldConfigPath);

	const tempConfigPath = join('.vercel', 'temp-nop-config.json');
	const tempConfig: VercelConfigJson = {
		framework: 'nextjs',
		...config,
		// User-defined config values should override the ones we set.
		...originalConfig,
	};

	await writeFile(tempConfigPath, JSON.stringify(tempConfig));

	return {
		additionalArgs: ['--local-config', tempConfigPath],
		tempPath: tempConfigPath,
	};
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

type TempVercelConfigInfo = { additionalArgs: string[]; tempPath: string };

async function runVercelBuild(
	pm: PackageManager,
	additionalArgs: string[] = [],
): Promise<void> {
	if (pm.name === 'yarn' && pm.version.startsWith('1.')) {
		const vercelInfo = await pm.getPackageInfo('vercel');

		if (!vercelInfo) {
			cliLog(
				`vercel dev dependency missing, installing vercel as a dev dependency with '${pm.name} add vercel -D'...`,
			);

			const installVercel = spawn(pm.name, ['add', 'vercel', '-D']);

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
	pm: PackageManager,
	additionalArgs: string[] = [],
): Promise<ChildProcessWithoutNullStreams> {
	const spawnCmd = await pm.getRunExecStruct('vercel', {
		args: ['build', ...additionalArgs],
		download: 'prefer-if-needed',
	});

	if (!spawnCmd) {
		throw new Error('Error: Failed to generate vercel build command');
	}

	return spawn(spawnCmd.cmd, spawnCmd.cmdArgs);
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
