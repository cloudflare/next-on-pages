import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readJsonFile } from '../../utils';

export type FunctionConfigs = {
	edgeFunctions: Map<string, VercelFunctionConfig>;
	prerenderedFunctions: Map<string, VercelFunctionConfig>;
	invalidFunctions: Map<string, VercelFunctionConfig>;
};

export async function collectFunctionConfigs(
	baseDir: string
): Promise<FunctionConfigs> {
	const functionConfigs = await collectFunctionConfigsRecursively(baseDir);

	const edgeFunctions = new Map<string, VercelFunctionConfig>();
	const prerenderedFunctions = new Map<string, VercelFunctionConfig>();
	const invalidFunctions = new Map<string, VercelFunctionConfig>();

	for (const [path, config] of functionConfigs) {
		if (config.operationType === 'ISR') {
			prerenderedFunctions.set(path, config);
		} else if (config.runtime === 'edge') {
			edgeFunctions.set(path, config);
		} else {
			invalidFunctions.set(path, config);
		}
	}

	return { edgeFunctions, prerenderedFunctions, invalidFunctions };
}

async function collectFunctionConfigsRecursively(
	baseDir: string,
	configs: Map<string, VercelFunctionConfig> = new Map()
): Promise<Map<string, VercelFunctionConfig>> {
	const files = await readdir(baseDir, { withFileTypes: true });
	const directories = files.filter(file => file.isDirectory());

	for (const dir of directories) {
		const dirPath = join(baseDir, dir.name);

		if (dir.name.endsWith('.func')) {
			const configPath = join(dirPath, '.vc-config.json');
			const config = await readJsonFile<VercelFunctionConfig>(configPath);

			if (config) {
				configs.set(dirPath, config);
			}
		} else {
			await collectFunctionConfigsRecursively(dirPath, configs);
		}
	}

	return configs;
}
