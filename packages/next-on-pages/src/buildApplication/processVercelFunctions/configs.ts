import { join, relative } from 'node:path';
import {
	addLeadingSlash,
	formatRoutePath,
	getRouteOverrides,
	normalizePath,
	readDirectories,
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
	const dirs = await readDirectories(baseDir);

	for (const { path } of dirs) {
		if (path.endsWith('.func')) {
			const configPath = join(path, '.vc-config.json');
			const config = await readJsonFile<VercelFunctionConfig>(configPath);

			const relativePath = addLeadingSlash(
				normalizePath(relative(configs.functionsDir, path)),
			);

			if (config?.operationType?.toLowerCase() === 'isr') {
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
	route?: {
		path: string;
		headers?: Record<string, string>;
		overrides?: string[];
	};
};
