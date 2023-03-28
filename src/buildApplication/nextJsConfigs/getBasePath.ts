import { readFile } from 'fs/promises';
import { cliWarn } from '../../cli';

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
	// RoutesManifest.version and RoutesManifest.basePath are the only fields accessed
	interface RoutesManifest {
		version: 3;
		basePath: string;
	}

	let routesManifest: RoutesManifest | null = null;

	try {
		routesManifest = JSON.parse(
			await readFile('.next/routes-manifest.json', 'utf8')
		);
	} catch {
		/* empty */
	}

	if (!routesManifest || routesManifest.version !== 3) {
		cliWarn(
			'Warning: Could not read basePath from .next/routes-manifest.json file'
		);
		cliWarn('falling back to empty basePath');
		return null;
	}

	return routesManifest.basePath ?? null;
}
