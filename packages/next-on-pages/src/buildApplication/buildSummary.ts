import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { cliLog } from '../cli';
import { addLeadingSlash, nextOnPagesVersion, stripIndexRoute } from '../utils';
import type { DirectoryProcessingResults } from './generateFunctionsMap';

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
 * Adds a group of items to the build summary, limiting the number of items to be displayed if
 * necessary.
 *
 * Formats the items with stylised prefixes and indentations.
 *
 * @param summary Current summary.
 * @param name The name of the group of items.
 * @param rawItems List of items to be added to the summary.
 * @param limit Maximum number of items to be displayed.
 * @returns The updated summary.
 */
function addToSummary(
	summary: string,
	name: string,
	rawItems: string[],
	limit?: number
): string {
	if (rawItems.length === 0) return summary;

	const items =
		limit && rawItems.length > limit
			? [
					...rawItems.slice(0, limit - 1),
					`... ${rawItems.length - limit - 1} more`,
			  ]
			: rawItems;

	const formattedItems = items
		.map((path, idx) => `  ${getItemPrefix(items.length, idx)} ${path}`)
		.join('\n');

	return `${summary}
	
${name} (${rawItems.length})
${formattedItems}`;
}

/**
 * Prints a build summary to the console.
 *
 * @param staticAssets List of static assets collected during the build.
 * @param directoryProcessingResults Results of processing the output directory.
 */
export function printBuildSummary(
	staticAssets: string[],
	{
		functionsMap = new Map(),
		prerenderedRoutes = new Map(),
		wasmIdentifiers = new Map(),
	}: Partial<DirectoryProcessingResults> = {}
): void {
	const functions = processItemsMap(functionsMap);
	const prerendered = processItemsMap(prerenderedRoutes);

	let otherStatic = staticAssets
		.filter(path => !prerenderedRoutes.has(path))
		.sort((a, b) => a.localeCompare(b));

	// Move the `/_next` and `/__next` assets to the end of the static assets list
	otherStatic = [
		...otherStatic.filter(path => !/^\/__?next/.test(path)),
		...otherStatic.filter(path => /^\/__?next/.test(path)),
	];

	let summary = `Build Summary (@cloudflare/next-on-pages v${nextOnPagesVersion})`;
	summary = addToSummary(summary, 'Edge Function Routes', functions);
	summary = addToSummary(summary, 'Prerendered Routes', prerendered, 20);
	summary = addToSummary(summary, 'Wasm Files', [...wasmIdentifiers.keys()]);
	summary = addToSummary(summary, 'Other Static Assets', otherStatic, 5);

	cliLog(summary, { spaced: true, skipDedent: true });
}

/**
 * Writes information about the build to a specific directory.
 *
 * @param outputDir Output directory.
 * @param staticAssets List of static assets collected during the build.
 * @param directoryProcessingResults Results of processing the output directory.
 */
export async function writeBuildInfo(
	outputDir: string,
	staticAssets: string[],
	{
		invalidFunctions = new Set(),
		functionsMap = new Map(),
		prerenderedRoutes = new Map(),
		wasmIdentifiers = new Map(),
	}: Partial<DirectoryProcessingResults> = {}
): Promise<void> {
	const currentDir = resolve();
	const filePath = join(outputDir, 'nop-build-info.json');

	// Change wasm paths to be relative to avoid leaking file system structure or account username.
	const desensitizedWasmIdentifiers = [...wasmIdentifiers.values()].map(
		({ originalFileLocation, ...rest }) => ({
			...rest,
			originalFileLocation: relative(currentDir, originalFileLocation),
		})
	);

	await mkdir(outputDir, { recursive: true });
	await writeFile(
		filePath,
		JSON.stringify(
			{
				version: nextOnPagesVersion,
				timestamp: Date.now(),
				outputDir: relative(currentDir, outputDir),
				buildFiles: {
					invalidFunctions: [...invalidFunctions.values()],
					edgeFunctions: [...functionsMap.keys()],
					prerenderFunctionFallbackFiles: [...prerenderedRoutes.keys()],
					wasmFiles: desensitizedWasmIdentifiers,
					staticAssets: staticAssets.filter(
						path => !prerenderedRoutes.has(path)
					),
				},
			},
			null,
			2
		)
	);

	cliLog(`Build info saved to '${relative(currentDir, filePath)}'`);
}