import YAML from 'js-yaml';
import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { cliError } from '../cli';
import { validateFile } from '../utils';

export async function getCurrentPackageManager(): Promise<PackageManager> {
	const userAgent = process.env.npm_config_user_agent;

	const hasYarnLock = await validateFile('yarn.lock');
	const hasPnpmLock = await validateFile('pnpm-lock.yaml');

	if ((userAgent && userAgent.startsWith('pnpm')) || hasPnpmLock) return 'pnpm';

	if ((userAgent && userAgent.startsWith('yarn')) || hasYarnLock) {
		const yarn = getPackageManagerSpawnCommand('yarn');
		const getYarnV = spawn(yarn, ['-v']);
		let yarnV = '';
		getYarnV.stdout.on('data', data => {
			yarnV = `${data}`.trimEnd();
		});
		getYarnV.stderr.on('data', data => cliError(`\n${data}`));
		await new Promise((resolve, reject) => {
			getYarnV.on('close', code => {
				if (code === 0) {
					resolve(null);
				} else {
					reject();
				}
			});
		});
		if (!yarnV.startsWith('1.')) {
			const yarnrc = await readFile('.yarnrc.yml', 'utf-8');
			const { nodeLinker } = YAML.load(yarnrc) as {
				nodeLinker: string;
			};
			if (nodeLinker !== 'node-modules')
				throw new Error(`
				@cloudflare/next-on-pages doesn't support Plug'n'Play features from yarn berry.

				If you want to use @cloudflare/next-on-pages with yarn berry,
				please add "nodeLinker: node-modules" to your .yarnrc.yml
				`);
			return 'yarn (berry)';
		} else {
			return 'yarn (classic)';
		}
	}
	return 'npm';
}

export async function getCurrentPackageExecuter(): Promise<string> {
	const cmd = isWindows() ? '.cmd' : '';
	const packageManager = await getCurrentPackageManager();
	switch (packageManager) {
		case 'npm':
			return `npx${cmd}`;
		case 'pnpm':
			return `pnpx${cmd}`;
		case 'yarn (berry)':
			return `yarn${cmd} dlx`;
		case 'yarn (classic)':
			return `yarn${cmd}`;
		default:
			return `npx${cmd}`;
	}
}

const packageManagers = {
	pnpm: 'pnpx',
	'yarn (berry)': 'yarn',
	'yarn (classic)': 'yarn',
	yarn: 'yarn',
	npm: 'npx',
};

export type PackageManager = keyof typeof packageManagers;

export function getPackageManagerSpawnCommand(
	pkgMng: keyof typeof packageManagers
): string {
	const winCMD = isWindows() ? '.cmd' : '';
	return `${packageManagers[pkgMng]}${winCMD}`;
}

function isWindows(): boolean {
	return process.platform === 'win32';
}
