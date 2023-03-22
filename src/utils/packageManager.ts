import { existsSync } from 'fs';

export type PackageManager = 'npm' | 'yarn' | 'pnpm';

export function getCurrentPackageManager(): PackageManager {
	if (existsSync('yarn.lock')) {
		return 'yarn';
	}

	if (existsSync('pnpm-lock.yaml')) {
		return 'pnpm';
	}

	return 'npm';
}
