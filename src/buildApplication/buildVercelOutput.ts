import { writeFile, mkdir, rm, rmdir } from 'fs/promises';
import { spawn } from 'child_process';
import { join, resolve } from 'path';
import { cliError, cliLog } from '../cli';
import { validateDir, validateFile } from '../utils';
import { checkPackageManager } from './checkPackageManager';

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
	const pkgMng = await checkPackageManager();
	cliLog(`Detected Package Manager: ${pkgMng}\n`);
	cliLog(`Preparing project...`);
	await generateProjectJsonFileIfNeeded();
	cliLog(`Project is ready`);
	await runVercelBuild(pkgMng);
	cliLog('Building Completed.\n');
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

async function runVercelBuild(
	pkgMng: 'pnpm' | 'yarn (berry)' | 'yarn (classic)' | 'npm'
): Promise<void> {
	cliLog(`Building project...`);

	let cmd = '',
		args = [];
	const winCMD = process.platform === 'win32' ? '.cmd' : '';

	if (pkgMng === 'yarn (classic)') {
		cliLog(
			`Installing vercel as dev dependencies with 'yarn add vercel -D'...`
		);

		const installVercel = spawn(`yarn${winCMD}`, ['add', 'vercel', '-D']);

		installVercel.stdout.on('data', data => cliLog(`\n${data}`, true));
		installVercel.stderr.on('data', data => cliError(`\n${data}`, false, true));

		await new Promise((resolve, reject) => {
			installVercel.on('close', code => {
				if (code === 0) {
					resolve(null);
				} else {
					reject();
				}
			});
		});

		cliLog(`Install completed`);

		(cmd = `yarn${winCMD}`), (args = ['vercel', 'build']);
	}

	if (pkgMng === 'pnpm') (cmd = `pnpx${winCMD}`), (args = ['vercel', 'build']);
	if (pkgMng === 'npm') (cmd = `npx${winCMD}`), (args = ['vercel', 'build']);
	if (pkgMng === 'yarn (berry)')
		(cmd = `yarn${winCMD}`), (args = ['dlx', 'vercel', 'build']);

	cliLog(`Building project with '${cmd} ${args.join(' ')}'...`);

	const vercelBuild = spawn(cmd, args);

	vercelBuild.stdout.on('data', data => cliLog(`\n${data}`, true));
	vercelBuild.stderr.on('data', data => cliError(`\n${data}`, false, true));

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
