/**
 * Checks whether the current platform is Windows.
 *
 * @returns Whether the current platform is Windows.
 */
export function isWindows(): boolean {
	return process.platform === 'win32';
}
