const packageManagers = {
	pnpm: 'pnpx',
	'yarn (berry)': 'yarn',
	'yarn (classic)': 'yarn',
	yarn: 'yarn',
	npm: 'npx',
};

export type PackageManager = keyof typeof packageManagers;

export function getSpawnCommand(pkgMng: keyof typeof packageManagers): string {
	const winCMD = process.platform === 'win32' ? '.cmd' : '';
	return `${packageManagers[pkgMng]}${winCMD}`;
}
