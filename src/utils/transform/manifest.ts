/**
 * Check if a function file name matches an entry in the manifest.
 *
 * @param entry Manifest entry name.
 * @param file Function file name.
 * @returns Whether the function file name matches the manifest entry name.
 */
export const matchFunctionEntry = (entry: string, file: string) => {
  // app directory
  if (entry.startsWith('app/')) {
    const type = entry.endsWith('/route') ? '/route' : '/page';
    return `app${file !== 'index' ? `/${file}` : ''}${type}` === entry;
  }

  // pages directory
  return entry.startsWith('pages/') && `pages/${file}` === entry;
};
