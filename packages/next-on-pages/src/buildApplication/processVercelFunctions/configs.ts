import { join, relative } from 'node:path';
import type { PathInfo } from '../../utils';
import {
	addLeadingSlash,
	formatRoutePath,
	getRouteOverrides,
	normalizePath,
	readFilesAndDirectories,
	readJsonFile,
} from '../../utils';

/**
 * Collects all the Vercel build output function configs recursively from the given directory.
 *
 * @param baseDir Base directory to start collecting from.
 * @param configs Object to store the collected configs in.
 * @returns The given configs object with the collected configs.
 */
export async function collectFunctionConfigsRecursively(
	baseDir: string,
	configs: CollectedFunctions = {
		functionsDir: baseDir,
		edgeFunctions: new Map(),
		prerenderedFunctions: new Map(),
		invalidFunctions: new Map(),
		ignoredFunctions: new Map(),
	},
): Promise<CollectedFunctions> {
	const paths = await readFilesAndDirectories(baseDir);
	const dirs = paths.filter(path => path.isDirectory);
	const files = paths.filter(path => !path.isDirectory);

	for (const { path } of dirs) {
		if (path.endsWith('.func')) {
			const configPath = join(path, '.vc-config.json');
			const config = await readJsonFile<VercelFunctionConfig>(configPath);

			const relativePath = addLeadingSlash(
				normalizePath(relative(configs.functionsDir, path)),
			);

			const isPrerenderedIsrFunc =
				config?.operationType?.toLowerCase() === 'isr' &&
				!path.endsWith('.action.func');
			const isPrerenderedApiFunc =
				config?.operationType?.toLowerCase() === 'api' &&
				checkPrerenderConfigExists(path, files);

			if (isPrerenderedIsrFunc || isPrerenderedApiFunc) {
				configs.prerenderedFunctions.set(path, { relativePath, config });
			} else if (config?.runtime?.toLowerCase() === 'edge') {
				const formattedPathName = formatRoutePath(relativePath);
				const overrides = getRouteOverrides(formattedPathName);

				configs.edgeFunctions.set(path, {
					relativePath,
					config,
					route: { path: formattedPathName, overrides },
				});
			} else if (config) {
				configs.invalidFunctions.set(path, { relativePath, config });
			}
		} else {
			await collectFunctionConfigsRecursively(path, configs);
		}
	}

	return configs;
}

function checkPrerenderConfigExists(funcPath: string, files: PathInfo[]) {
	const prerenderConfigPath = funcPath.replace(
		/\.func$/,
		'.prerender-config.json',
	);

	return files.find(({ path }) => path === prerenderConfigPath);
}

export type CollectedFunctions = {
	functionsDir: string;
	edgeFunctions: Map<string, FunctionInfo>;
	prerenderedFunctions: Map<string, FunctionInfo>;
	invalidFunctions: Map<string, FunctionInfo>;
	ignoredFunctions: Map<string, FunctionInfo & { reason?: string }>;
};

export type FunctionInfo = {
	relativePath: string;
	config: VercelFunctionConfig;
	outputPath?: string;
	outputByteSize?: number;
	route?: {
		path: string;
		headers?: Record<string, string>;
		overrides?: string[];
	};
};
