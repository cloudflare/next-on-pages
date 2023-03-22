import { writeFile, mkdir, stat } from 'fs/promises';
import { spawn } from 'child_process';
import { cliError, cliLog } from '../cli';
import { getCurrentPackageManager } from '../utils/packageManager';

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
	cliLog(`
		Preparing project for 'npx vercel build'...
	`);
	await generateProjectJsonFileIfNeeded();
	cliLog(
		`Project ready for 'npx vercel build'...

		Building project with 'npx vercel build'...
	`
	);
	await runVercelBuild();
	cliLog('Completed `npx vercel build`.\n');
}

/**
 * The Vercel CLI seems to require the presence of a project.json file,
 * so we create a dummy one just to satisfy Vercel
 */
async function generateProjectJsonFileIfNeeded(): Promise<void> {
	try {
		await stat('.vercel/project.json');
	} catch {
		await mkdir('.vercel', { recursive: true });
		await writeFile(
			'.vercel/project.json',
			JSON.stringify({ projectId: '_', orgId: '_', settings: {} })
		);
	}
}

function spawnVercelBuild() {
	const windowsSuffix = process.platform === 'win32' ? '.cmp' : '';
	const packageManager = getCurrentPackageManager();

	if (packageManager === 'yarn') {
		throw new Error('yarn is not supported');
	}

	if (packageManager === 'pnpm') {
		const vercelBuild = spawn(`pnpx${windowsSuffix}`, ['vercel', 'build']);
		return vercelBuild;
	}

	const vercelBuild = spawn(`npx${windowsSuffix}`, ['vercel', 'build']);
	return vercelBuild;
}

async function runVercelBuild(): Promise<void> {
	const vercelBuild = spawnVercelBuild();

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
