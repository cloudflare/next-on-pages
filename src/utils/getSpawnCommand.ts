import { isWindows } from "./isWindows";

const packageManagers = {
	pnpm: 'pnpx',
	'yarn (berry)': 'yarn',
	'yarn (classic)': 'yarn',
	yarn: 'yarn',
	npm: 'npx',
};

export type PackageManager = keyof typeof packageManagers;

export function getSpawnCommand(pkgMng: keyof typeof packageManagers): string {
	const winCMD = isWindows() ? '.cmd' : '';
	return `${packageManagers[pkgMng]}${winCMD}`;
}
