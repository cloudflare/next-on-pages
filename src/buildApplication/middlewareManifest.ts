/**
 * IMPORTANT: this file relates to the .next/server/middleware-manifest.json file
 *	moving forward we want to rely solely on the .vercel/output file so everything in this file
 *  should be refactored to use .vercel/output instead as soon as possible
 */

import { readFile } from 'fs/promises';

export type MiddlewareManifest = {
	middleware: Record<
		string,
		{
			env: string[];
			files: string[];
			name: string;
			matchers: { regexp: string }[];
			wasm: [];
			assets: [];
		}
	>;
	functions: Record<
		string,
		{
			env: string[];
			files: string[];
			name: string;
			page: string;
			matchers: { regexp: string }[];
			wasm: [];
			assets: [];
		}
	>;
	version: 2;
};

export type MiddlewareManifestData = Awaited<
	ReturnType<typeof parseMiddlewareManifest>
>;

/**
 * Parses the middleware manifest and validates it against the existing functions map.
 */
export async function parseMiddlewareManifest(
	functionsMap: Map<string, string>
) {
	let middlewareManifest: MiddlewareManifest;
	try {
		// Annoying that we don't get this from the `.vercel` directory.
		// Maybe we eventually just construct something similar from the `.vercel/output/functions` directory with the same magic filename/precendence rules?
		middlewareManifest = JSON.parse(
			await readFile('.next/server/middleware-manifest.json', 'utf8')
		);
	} catch {
		throw new Error('Could not read the functions manifest.');
	}

	if (middlewareManifest.version !== 2) {
		throw new Error(
			`Unknown functions manifest version. Expected 2 but found ${middlewareManifest.version}.`
		);
	}

	const hydratedMiddleware = new Map<
		string,
		{
			matchers: { regexp: string }[];
			filepath: string;
		}
	>();
	const hydratedFunctions = new Map<
		string,
		{
			matchers: { regexp: string }[];
			filepath: string;
		}
	>();

	const middlewareEntries = Object.values(middlewareManifest.middleware);
	const functionsEntries = Object.values(middlewareManifest.functions);

	for (const [name, filepath] of functionsMap) {
		if (
			middlewareEntries.length > 0 &&
			(name === 'middleware' || name === 'src/middleware')
		) {
			for (const entry of middlewareEntries) {
				if (entry?.name === 'middleware' || entry?.name === 'src/middleware') {
					hydratedMiddleware.set(name, { matchers: entry.matchers, filepath });
				}
			}
		}

		for (const entry of functionsEntries) {
			if (matchFunctionEntry(entry.name, name)) {
				hydratedFunctions.set(name, { matchers: entry.matchers, filepath });
			}
		}
	}

	const rscFunctions = [...functionsMap.keys()].filter(name =>
		name.endsWith('.rsc')
	);

	if (
		hydratedMiddleware.size + hydratedFunctions.size !==
		functionsMap.size - rscFunctions.length
	) {
		throw new Error(
			'⚡️ ERROR: Could not map all functions to an entry in the middleware manifest.'
		);
	}

	return {
		hydratedMiddleware,
		hydratedFunctions,
	};
}

/**
 * Check if a function file name matches an entry in the middleware manifest file
 *
 * @param entryName Manifest entry name.
 * @param fileName Function file name.
 * @returns Whether the function file name matches the manifest entry name.
 */
function matchFunctionEntry(entryName: string, fileName: string) {
	// app directory
	if (entryName.startsWith('app/')) {
		const type = entryName.endsWith('/route') ? '/route' : '/page';
		return (
			`app${fileName !== 'index' ? `/${fileName}` : ''}${type}` === entryName
		);
	}

	// pages directory
	return entryName.startsWith('pages/') && `pages/${fileName}` === entryName;
}
