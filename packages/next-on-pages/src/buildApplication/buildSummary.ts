import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { cliLog } from '../cli';
import {
	addLeadingSlash,
	nextOnPagesVersion,
	stripFuncExtension,
	stripIndexRoute,
} from '../utils';
import type { ProcessedVercelOutput } from './processVercelOutput';
import type { ProcessedVercelFunctions } from './processVercelFunctions';
import type { FunctionInfo } from './processVercelFunctions/configs';
import type {
	IdentifierInfo,
	IdentifiersMap,
} from './processVercelFunctions/ast';

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
		collectedFunctions,
		identifiers,
	}: ProcessedVercelFunctions = emptyProcessedVercelFunctions,
): void {
	const { edgeFunctions, prerenderedFunctions } = collectedFunctions;
	const middlewareFunctions = [...vercelOutput.entries()]
		.filter(([, { type }]) => type === 'middleware')
		.map(([path]) => path)
		.sort((a, b) => a.localeCompare(b));
	const routeFunctions = new Set(
		processItemsMap(edgeFunctions).filter(
			path => !middlewareFunctions.includes(path.replace(/^\//, '')),
		),
	);
	const prerendered = processItemsMap(prerenderedFunctions);
	const prerenderedPaths = new Set(
		[...prerenderedFunctions.values()].map(v => v.route?.path),
	);
	const otherStatic = staticAssets
		.filter(path => !prerenderedPaths.has(path))
		.sort((a, b) => {
			// Note: `/_next` and `/__next` assets are sorted to the end of the static assets list
			const aIsNextAsset = /^\/__?next/.test(a);
			const bIsNextAsset = /^\/__?next/.test(b);
			if (!aIsNextAsset && bIsNextAsset) return -1;
			if (aIsNextAsset && !bIsNextAsset) return 1;

			return a.localeCompare(b);
		});
	const bundledAssets = new Set(
		[...edgeFunctions.values()]
			.map(({ config }) => config?.assets?.map(asset => asset.name))
			.flat()
			.filter(Boolean) as string[],
	);

	const summaryTitle = `Build Summary (@cloudflare/next-on-pages v${nextOnPagesVersion})`;
	const summarySections = constructSummarySections([
		{ name: 'Middleware Functions', rawItems: middlewareFunctions },
		{ name: 'Edge Function Routes', rawItems: [...routeFunctions] },
		{ name: 'Prerendered Routes', rawItems: prerendered, limit: 20 },
		{
			name: 'Wasm Files',
			rawItems: [...identifiers.identifierMaps.wasm.keys()],
		},
		{ name: 'Bundled Assets', rawItems: [...bundledAssets] },
		{ name: 'Other Static Assets', rawItems: otherStatic, limit: 5 },
	]);
	const summary = `${summaryTitle}\n\n${summarySections}`;

	cliLog(summary, { spaced: true, skipDedent: true });
}

/**
 * Writes information about the build to a json log file.
 *
 * @param directories Vercel functions and output directories.
 * @param staticAssets List of static assets collected during the build.
 * @param processedVercelOutput Results of processing the Vercel output directory.
 * @param directoryProcessingResults Results of processing the output directory.
 */
export async function writeBuildInfo(
	{ outputDir, functionsDir }: { outputDir: string; functionsDir: string },
	staticAssets: string[],
	{ vercelOutput }: ProcessedVercelOutput,
	{
		collectedFunctions,
		identifiers,
	}: ProcessedVercelFunctions = emptyProcessedVercelFunctions,
): Promise<void> {
	const currentDir = resolve();
	const buildLogFilePath = join(outputDir, 'nop-build-log.json');

	const {
		edgeFunctions,
		prerenderedFunctions,
		ignoredFunctions,
		invalidFunctions,
	} = collectedFunctions;

	const prerenderedPaths = new Set(
		[...prerenderedFunctions.values()].map(v => v.route?.path),
	);

	const buildLogObject: BuildLog = {
		timestamp: Date.now(),
		outputDir: relative(currentDir, outputDir),
		versions: {
			'@cloudflare/next-on-pages': nextOnPagesVersion,
		},
		buildFiles: {
			functions: {
				invalid: [...invalidFunctions.values()],
				middleware: [...vercelOutput]
					.filter(([, { type }]) => type === 'middleware')
					.map(([path]) => path),
				edge: [...edgeFunctions.values()],
				prerendered: [...prerenderedFunctions.values()],
				ignored: [...ignoredFunctions.values()],
			},
			staticAssets: staticAssets.filter(path => !prerenderedPaths.has(path)),
			identifiers: {
				wasm: formatIdentifiersMap(
					identifiers.identifierMaps.wasm,
					functionsDir,
				),
				manifest: formatIdentifiersMap(
					identifiers.identifierMaps.manifest,
					functionsDir,
				),
				webpack: formatIdentifiersMap(
					identifiers.identifierMaps.webpack,
					functionsDir,
				),
			},
		},
	};
	let buildLogText = ""
	try{
		buildLogText = JSON.stringify(buildLogObject, null, 2);
	} catch(e) {
		cliLog("Build log too large to save");
	}

	await mkdir(outputDir, { recursive: true });
	await writeFile(buildLogFilePath, buildLogText);

	cliLog(`Build log saved to '${relative(currentDir, buildLogFilePath)}'`);
}

/**
 * Formats a map of identifiers into an object with the consumers length added.
 *
 * @param identifiersMap Map of identifiers to process.
 * @param functionsDir Path to the Vercel functions directory.
 * @returns A new map with the formatted identifiers.
 */
function formatIdentifiersMap(
	identifiersMap: IdentifiersMap,
	functionsDir: string,
): Record<string, IdentifierInfoWithConsumersLength> {
	return Object.fromEntries(
		[...identifiersMap].map(([identifier, info]) => [
			identifier,
			{
				...info,
				consumers: info.consumers.length,
				consumersList: info.consumers.map(c => c.replace(functionsDir, '')),
			},
		]),
	);
}

const emptyProcessedVercelFunctions: ProcessedVercelFunctions = {
	collectedFunctions: {
		functionsDir: '',
		edgeFunctions: new Map(),
		prerenderedFunctions: new Map(),
		ignoredFunctions: new Map(),
		invalidFunctions: new Map(),
	},
	identifiers: {
		entrypointsMap: new Map(),
		identifierMaps: {
			wasm: new Map(),
			manifest: new Map(),
			webpack: new Map(),
		},
	},
};

export type BuildLog = {
	timestamp: number;
	outputDir: string;
	versions: {
		'@cloudflare/next-on-pages': string;
	};
	buildFiles: {
		functions: {
			invalid: FunctionInfo[];
			middleware: string[];
			edge: FunctionInfo[];
			prerendered: FunctionInfo[];
			ignored: FunctionInfo[];
		};
		staticAssets: string[];
		identifiers: {
			wasm: Record<string, IdentifierInfoWithConsumersLength>;
			manifest: Record<string, IdentifierInfoWithConsumersLength>;
			webpack: Record<string, IdentifierInfoWithConsumersLength>;
		};
	};
};

type IdentifierInfoWithConsumersLength = Override<
	IdentifierInfo,
	'consumers',
	number
>;

/**
 * Processes a map of items into a list that can be used in the build summary.
 *
 * Filters out `.rsc` files and strips `.html` from the end of the path, sorting the list
 * alphabetically.
 *
 * @param items A map of items to process.
 * @returns A list of items to be used in the build summary.
 */
function processItemsMap(items: Map<string, FunctionInfo>): string[] {
	return [...items.values()]
		.map(({ relativePath, route }) =>
			addLeadingSlash(
				stripIndexRoute(
					(route?.path ?? stripFuncExtension(relativePath)).replace(
						/\.html$/,
						'',
					),
				),
			),
		)
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
function constructSummarySections(sections: SummarySection[]): string {
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

type SummarySection = { name: string; rawItems: string[]; limit?: number };
