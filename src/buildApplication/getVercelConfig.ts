import { readJsonFile } from '../utils';

const supportedConfigVersion = 3;

/**
 * gets the vercel config from the `.vercel/output/config.json` file, throws
 * if the file can't be parsed or if it contains a vercel config of the wrong version
 *
 * TODO: add validation to make sure that the parsed config is in the format
 *       we expect it to be
 *
 * @returns the object parsed from the config file
 */
export async function getVercelConfig(): Promise<VercelConfig> {
	const config = await readJsonFile<VercelConfig>('.vercel/output/config.json');
	if (!config) {
		throw new Error("Could not read the '.vercel/output/config.json' file.");
	}

	if (config.version !== supportedConfigVersion) {
		throw new Error(
			`Unknown '.vercel/output/config.json' version. Expected ${supportedConfigVersion} but found ${config.version}.`
		);
	}

	return config;
}

export function processVercelConfig(
	config: VercelConfig
): ProcessedVercelConfig {
	const processedConfig: ProcessedVercelConfig = {
		...config,
		routes: {
			none: [],
			filesystem: [],
			miss: [],
			rewrite: [],
			resource: [],
			hit: [],
			error: [],
		},
	};

	let currentPhase: VercelHandleValue | 'none' = 'none';
        config.routes.forEach(route => {
          if('handle' in route) {
                currentPhase = route.handle;
          } else {
		processedConfig.routes[currentPhase].push(route);          
          }
        });

	return processedConfig;
}
