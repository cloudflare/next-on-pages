import type { PackageManager } from 'package-manager-manager';

/**
 * Utility that retrieves the version of an installed package. In case the package is not installed or
 * retrieving the version of the package generated errors null is returned instead.
 *
 * @param pm package manager object to use
 * @param packageName name of the package
 * @returns the version of the installed package if it was successfully detected, null otherwise
 */
export async function getPackageVersionOrNull(
	pm: PackageManager,
	packageName: string,
): Promise<string | null> {
	const packageInfo = await pm.getPackageInfo(packageName).catch(() => null);
	return packageInfo?.version ?? null;
}
