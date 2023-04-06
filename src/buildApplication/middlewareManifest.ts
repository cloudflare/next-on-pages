/**
 * IMPORTANT: this file relates to the .next/server/middleware-manifest.json file
 *	moving forward we want to rely solely on the .vercel/output file so everything in this file
 *  should be refactored to use .vercel/output instead as soon as possible
 */

// NOTE: This file and the corresponding logic will be removed in the new routing system.

import { readJsonFile, stripIndexRoute, stripRouteGroups } from '../utils';
import type { NextJsConfigs } from './nextJsConfigs';

export type EdgeFunctionDefinition = {
	name: string;
	matchers: { regexp: string }[];
	env?: string[];
	files?: string[];
	page?: string;
	wasm?: [];
	assets?: [];
	regions?: string[] | string;
};

export type MiddlewareManifest = {
	middleware: Record<string, EdgeFunctionDefinition>;
	functions: Record<string, EdgeFunctionDefinition>;
	version: 2;
};

export type MiddlewareManifestData = Awaited<
	ReturnType<typeof parseMiddlewareManifest>
>;

/**
 * gets the parsed middleware manifest and validates it against the existing functions map.
 */
export async function getParsedMiddlewareManifest(
	functionsMap: Map<string, string>,
	{ basePath }: NextJsConfigs
) {
	// Annoying that we don't get this from the `.vercel` directory.
	// Maybe we eventually just construct something similar from the `.vercel/output/functions` directory with the same magic filename/precendence rules?
	const middlewareManifest = await readJsonFile<MiddlewareManifest>(
		'.next/server/middleware-manifest.json'
	);
	if (!middlewareManifest) {
		throw new Error('Could not read the functions manifest.');
	}

	return parseMiddlewareManifest(middlewareManifest, functionsMap, basePath);
}

export function parseMiddlewareManifest(
	middlewareManifest: MiddlewareManifest,
	functionsMap: Map<string, string>,
	basePath?: string
) {
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
		// the .vc-config name includes the basePath, so we need to strip it for matching in the middleware manifest.
		const fileName = (basePath ? name.replace(basePath, '') : name).slice(1);

		if (
			middlewareEntries.length > 0 &&
			(fileName === 'middleware' || fileName === 'src/middleware')
		) {
			for (const entry of middlewareEntries) {
				if (entry?.name === 'middleware' || entry?.name === 'src/middleware') {
					hydratedMiddleware.set(name, { matchers: entry.matchers, filepath });
				}
			}
		}

		for (const entry of functionsEntries) {
			if (matchFunctionEntry(stripRouteGroups(entry.name), fileName)) {
				hydratedFunctions.set(name, { matchers: entry.matchers, filepath });

				// NOTE: Temporary to account for `/index` routes.
				if (stripIndexRoute(name) !== name) {
					hydratedFunctions.set(stripIndexRoute(name), {
						matchers: entry.matchers,
						filepath,
					});
				}
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
