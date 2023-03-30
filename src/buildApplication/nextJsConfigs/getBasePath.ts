import { cliWarn } from '../../cli';
import { readJsonFile } from '../../utils';

// RoutesManifest.version and RoutesManifest.basePath are the only fields accessed
type RoutesManifest = {
	version: 3;
	basePath: string;
};

/**
 * gets the basePath set by the developer in the next.config.js file
 *
 * IMPORTANT: this file reads the basePath from the .next/routes-manifest.json file
 *	moving forward we want to rely solely on the .vercel/output file so this function
 *  should be refactored to use .vercel/output instead as soon as possible
 *
 * @returns the basePath if set by the developer or null if no basePath is set or if
 *          the function was unable to read it
 */
export async function getBasePath(): Promise<string | null> {
	const routesManifest = await readJsonFile<RoutesManifest>(
		'.next/routes-manifest.json'
	);

	if (!routesManifest || routesManifest.version !== 3) {
		cliWarn(
			'Warning: Could not read basePath from .next/routes-manifest.json file'
		);
		cliWarn('falling back to empty basePath');
		return null;
	}

	return routesManifest.basePath ?? null;
}
