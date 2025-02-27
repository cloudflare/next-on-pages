/**
 * Newer versions of esbuild try to resolve dynamic imports by crawling the filesystem for matching modules.
 * This doesn't work with the code next-on-pages generates, because the modules don't necessarily exist on the filesystem.
 * This forces esbuild _not_ to look for matching modules on the filesystem (because esbuild doesn't inline functions when minifying)
 */
export async function doImport(m: string) {
	return import(m);
}
