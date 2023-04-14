import { writeFile, mkdir, rm, rmdir } from 'fs/promises';
import { spawn } from 'child_process';
import { join, resolve } from 'path';
import { cliLog, cliSuccess } from '../cli';
import { validateDir, validateFile } from '../utils';
import { getCurrentPackageManager } from './getCurrentPackageManager';
import { PackageManager, getSpawnCommand } from '../utils/getSpawnCommand';

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
	const pkgMng = await getCurrentPackageManager();
	cliLog(`Detected Package Manager: ${pkgMng}\n`);
	cliLog('Preparing project...');
	await generateProjectJsonFileIfNeeded();
	cliLog('Project is ready');
	await runVercelBuild(pkgMng);
	cliSuccess('Building Completed.\n');
}

/**
 * The Vercel CLI seems to require the presence of a project.json file,
 * so we create a dummy one just to satisfy Vercel
 */
async function generateProjectJsonFileIfNeeded(): Promise<void> {
	if (!(await validateFile('.vercel/project.json'))) {
		await mkdir('.vercel', { recursive: true });
		await writeFile(
			'.vercel/project.json',
			JSON.stringify({ projectId: '_', orgId: '_', settings: {} })
		);
	}
}

async function runVercelBuild(pkgMng: PackageManager): Promise<void> {
	const pkgMngCMD = getSpawnCommand(pkgMng);

	if (pkgMng === 'yarn (classic)') {
		cliLog(
			`Installing vercel as dev dependencies with 'yarn add vercel -D'...`
		);

		const installVercel = spawn(pkgMngCMD, ['add', 'vercel', '-D']);

		installVercel.stdout.on('data', data =>
			cliLog(`\n${data}`, { fromVercelCli: true })
		);
		installVercel.stderr.on('data', data =>
			cliLog(`\n${data}`, { fromVercelCli: true })
		);

		await new Promise((resolve, reject) => {
			installVercel.on('close', code => {
				if (code === 0) {
					resolve(null);
				} else {
					reject();
				}
			});
		});

		cliLog('Install completed');
	}

	cliLog('Building project...');

	const vercelBuild = spawn(pkgMngCMD, [
		...(pkgMng === 'yarn (berry)' ? ['dlx'] : []),
		'vercel',
		'build',
	]);

	vercelBuild.stdout.on('data', data =>
		cliLog(`\n${data}`, { fromVercelCli: true })
	);
	vercelBuild.stderr.on('data', data =>
		cliLog(`\n${data}`, { fromVercelCli: true })
	);

	await new Promise((resolve, reject) => {
		vercelBuild.on('close', code => {
			if (code === 0) {
				resolve(null);
			} else {
				reject();
			}
		});
	});
}

/**
 * Vercel and Next.js generate *private* files for telemetry purposes that are accessible as static assets (`.vercel/output/static/_next/__private/...`).
 *
 * The routing system for the build output *should* prevent these files from being accessible, but if someone were to exclude all static assets in an `_routes.json` file, they would be accessible.
 *
 * We do not need these files, nor do we want to run the risk of them being available. Therefore, we should delete them instead of uploading them to Cloudflare Pages.
 */
export async function deleteNextTelemetryFiles(): Promise<void> {
	const nextDir = resolve('.vercel/output/static/_next');
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
