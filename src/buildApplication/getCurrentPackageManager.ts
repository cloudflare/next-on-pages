import YAML from 'js-yaml';
import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { validateFile, getSpawnCommand, PackageManager } from '../utils';
import { cliError } from '../cli';

export async function getCurrentPackageManager(): Promise<PackageManager> {
	const userAgent = process.env.npm_config_user_agent;

	const hasYarnLock = await validateFile('yarn.lock');
	const hasPnpmLock = await validateFile('pnpm-lock.yaml');

	if ((userAgent && userAgent.startsWith('pnpm')) || hasPnpmLock) return 'pnpm';

	if ((userAgent && userAgent.startsWith('yarn')) || hasYarnLock) {
		const yarn = getSpawnCommand('yarn');
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
