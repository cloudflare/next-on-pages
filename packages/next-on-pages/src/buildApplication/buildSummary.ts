import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { cliLog } from '../cli';
import { addLeadingSlash, nextOnPagesVersion, stripIndexRoute } from '../utils';
import type { DirectoryProcessingResults } from './generateFunctionsMap';
import type { ProcessedVercelOutput } from './processVercelOutput';

/**
 * Prints a build summary to the console.
 *
 * @param staticAssets List of static assets collected during the build.
 * @param processedVercelOutput Results of processing the Vercel output directory.
 * @param directoryProcessingResults Results of processing the output directory.
 */
export function printBuildSummary(
	staticAssets: string[],
	{ vercelOutput }: ProcessedVercelOutput,
	{
		functionsMap = new Map(),
		prerenderedRoutes = new Map(),
		wasmIdentifiers = new Map(),
	}: Partial<DirectoryProcessingResults> = {},
): void {
	const middlewareFunctions = [...vercelOutput.entries()]
		.filter(([, { type }]) => type === 'middleware')
		.map(([path]) => path)
		.sort((a, b) => a.localeCompare(b));
	const routeFunctions = new Set(
		processItemsMap(functionsMap).filter(
			path => !middlewareFunctions.includes(path.replace(/^\//, '')),
		),
	);
	const prerendered = processItemsMap(prerenderedRoutes);
	const otherStatic = staticAssets
		.filter(path => !prerenderedRoutes.has(path))
		.sort((a, b) => {
			// Note: `/_next` and `/__next` assets are sorted to the end of the static assets list
			const aIsNextAsset = /^\/__?next/.test(a);
			const bIsNextAsset = /^\/__?next/.test(b);
			if (!aIsNextAsset && bIsNextAsset) return -1;
			if (aIsNextAsset && !bIsNextAsset) return 1;

			return a.localeCompare(b);
		});

	const summaryTitle = `Build Summary (@cloudflare/next-on-pages v${nextOnPagesVersion})`;
	const summarySections = constructSummarySections([
		{ name: 'Middleware Functions', rawItems: middlewareFunctions },
		{ name: 'Edge Function Routes', rawItems: [...routeFunctions] },
		{ name: 'Prerendered Routes', rawItems: prerendered, limit: 20 },
		{ name: 'Wasm Files', rawItems: [...wasmIdentifiers.keys()] },
		{ name: 'Other Static Assets', rawItems: otherStatic, limit: 5 },
	]);
	const summary = `${summaryTitle}\n\n${summarySections}`;

	cliLog(summary, { spaced: true, skipDedent: true });
}

/**
 * Writes information about the build to a json log file.
 *
 * @param outputDir Output directory.
 * @param staticAssets List of static assets collected during the build.
 * @param processedVercelOutput Results of processing the Vercel output directory.
 * @param directoryProcessingResults Results of processing the output directory.
 */
export async function writeBuildInfo(
	outputDir: string,
	staticAssets: string[],
	{ vercelOutput }: ProcessedVercelOutput,
	{
		invalidFunctions = new Set(),
		functionsMap = new Map(),
		prerenderedRoutes = new Map(),
		wasmIdentifiers = new Map(),
	}: Partial<DirectoryProcessingResults> = {},
): Promise<void> {
	const currentDir = resolve();
	const buildLogFilePath = join(outputDir, 'nop-build-log.json');

	// Change wasm paths to be relative to avoid leaking file system structure or account username.
	const desensitizedWasmIdentifiers = [...wasmIdentifiers.values()].map(
		({ originalFileLocation, ...rest }) => ({
			...rest,
			originalFileLocation: relative(currentDir, originalFileLocation),
		}),
	);

	const buildLogObject: BuildLog = {
		timestamp: Date.now(),
		outputDir: relative(currentDir, outputDir),
		versions: {
			'@cloudflare/next-on-pages': nextOnPagesVersion,
		},
		buildFiles: {
			invalidFunctions: [...invalidFunctions.values()],
			middlewareFunctions: [...vercelOutput.entries()]
				.filter(([, { type }]) => type === 'middleware')
				.map(([path]) => path),
			edgeFunctions: [...functionsMap.keys()],
			prerenderFunctionFallbackFiles: [...prerenderedRoutes.keys()],
			wasmFiles: desensitizedWasmIdentifiers,
			staticAssets: staticAssets.filter(path => !prerenderedRoutes.has(path)),
		},
	};
	const buildLogText = JSON.stringify(buildLogObject, null, 2);

	await mkdir(outputDir, { recursive: true });
	await writeFile(buildLogFilePath, buildLogText);

	cliLog(`Build log saved to '${relative(currentDir, buildLogFilePath)}'`);
}

export type BuildLog = {
	timestamp: number;
	outputDir: string;
	versions: {
		'@cloudflare/next-on-pages': string;
	};
	buildFiles: {
		invalidFunctions: string[];
		middlewareFunctions: string[];
		edgeFunctions: string[];
		prerenderFunctionFallbackFiles: string[];
		wasmFiles: {
			originalFileLocation: string;
			identifier: string;
			importPath: string;
		}[];
		staticAssets: string[];
	};
};

/**
 * Processes a map of items into a list that can be used in the build summary.
 *
 * Filters out `.rsc` files and strips `.html` from the end of the path, sorting the list
 * alphabetically.
 *
 * @param items A map of items to process.
 * @returns A list of items to be used in the build summary.
 */
function processItemsMap(items: Map<string, unknown>): string[] {
	return [...items.keys()]
		.filter(path => !/\.rsc$/.test(path))
		.map(path => addLeadingSlash(stripIndexRoute(path.replace(/\.html$/, ''))))
		.sort((a, b) => a.localeCompare(b));
}

/**
 * Returns a prefix to be used in the printed build summary for an item's index.
 *
 * @param total Total number of items.
 * @param idx Current item index.
 * @returns The prefix for the log message.
 */
function getItemPrefix(total: number, idx: number): string {
	if (total === 1) return '-';
	if (idx === 0) return '┌';
	if (idx === total - 1) return '└';
	return '├';
}

/**
 * Constructs a build summary for a group of sections.
 *
 * Formats the items with stylised prefixes and indentations.
 *
 * @param sections Build summary sections.
 * @returns The build summary.
 */
function constructSummarySections(
	sections: {
		name: string;
		rawItems: string[];
		limit?: number;
	}[],
): string {
	return sections
		.map(({ name, rawItems, limit }) => {
			if (rawItems.length === 0) return null;

			const items =
				limit && rawItems.length > limit
					? [
							...rawItems.slice(0, limit - 1),
							`... ${rawItems.length - limit + 1} more`,
					  ]
					: rawItems;

			const formattedItems = items
				.map((path, idx) => `  ${getItemPrefix(items.length, idx)} ${path}`)
				.join('\n');

			return `${name} (${rawItems.length})\n${formattedItems}`;
		})
		.filter(Boolean)
		.join('\n\n');
}
