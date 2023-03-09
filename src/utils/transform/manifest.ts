/**
 * Check if a function file name matches an entry in the manifest.
 *
 * @param entryName Manifest entry name.
 * @param fileName Function file name.
 * @returns Whether the function file name matches the manifest entry name.
 */
export const matchFunctionEntry = (entryName: string, fileName: string) => {
	// app directory
	if (entryName.startsWith('app/')) {
		const type = entryName.endsWith('/route') ? '/route' : '/page';
		return (
			`app${fileName !== 'index' ? `/${fileName}` : ''}${type}` === entryName
		);
	}

	// pages directory
	return entryName.startsWith('pages/') && `pages/${fileName}` === entryName;
};
