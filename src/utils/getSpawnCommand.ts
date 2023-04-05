const packageManagers = {
	pnpm: 'pnpx',
	'yarn (berry)': 'yarn',
	'yarn (classic)': 'yarn',
	yarn: 'yarn',
	npm: 'npx',
};

export function getSpawnCommand(pkgMng: packageManager | "yarn"): string {
	const winCMD = process.platform === 'win32' ? '.cmd' : '';
	return `${packageManagers[pkgMng]}${winCMD}`;
}
