import { join } from 'node:path';
import { readDirectories, readJsonFile } from '../../utils';

export type FunctionConfigs = {
	edgeFunctions: Map<string, VercelFunctionConfig>;
	prerenderedFunctions: Map<string, VercelFunctionConfig>;
	invalidFunctions: Map<string, VercelFunctionConfig>;
};

/**
 * Collects all the Vercel build output function configs recursively from the given directory.
 *
 * @param baseDir Base directory to start collecting from.
 * @param configs Object to store the collected configs in.
 * @returns The given configs object with the collected configs.
 */
export async function collectFunctionConfigsRecursively(
	baseDir: string,
	configs: FunctionConfigs = {
		edgeFunctions: new Map<string, VercelFunctionConfig>(),
		prerenderedFunctions: new Map<string, VercelFunctionConfig>(),
		invalidFunctions: new Map<string, VercelFunctionConfig>(),
	}
): Promise<FunctionConfigs> {
	const dirs = await readDirectories(baseDir);

	for (const { path } of dirs) {
		if (path.endsWith('.func')) {
			const configPath = join(path, '.vc-config.json');
			const config = await readJsonFile<VercelFunctionConfig>(configPath);

			if (config?.operationType === 'ISR') {
				configs.prerenderedFunctions.set(path, config);
			} else if (config?.runtime === 'edge') {
				configs.edgeFunctions.set(path, config);
			} else if (config) {
				configs.invalidFunctions.set(path, config);
			}
		} else {
			await collectFunctionConfigsRecursively(path, configs);
		}
	}

	return configs;
}
