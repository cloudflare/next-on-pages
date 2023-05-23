import { join } from 'path';
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
	const configPath = join('.vercel', 'output', 'config.json');
	const config = await readJsonFile<VercelConfig>(configPath);
	if (!config) {
		throw new Error(`Could not read the '${configPath}' file.`);
	}

	if (config.version !== supportedConfigVersion) {
		throw new Error(
			`Unknown '${configPath}' version. Expected ${supportedConfigVersion} but found ${config.version}.`
		);
	}

	return config;
}

/**
 * Gets the routes of a specific vercel phase
 *
 * @param config Vercel config object containing all the routes information
 * @param phase the phase from which extract the routes
 * @returns the phases' routes
 */
export function getPhaseRoutes(
	config: VercelConfig,
	phase: VercelPhase
): VercelRoute[] {
	const routes: VercelRoute[] = [];

	if (!config.routes) {
		return [];
	}

	let currentRouteIdx = 0;

	if (phase === 'none') {
		while (
			config.routes[currentRouteIdx] &&
			!(config.routes[currentRouteIdx] as VercelHandler).handle
		) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			routes.push(config.routes[currentRouteIdx]!);
			currentRouteIdx++;
		}
		return routes;
	}

	while (
		config.routes[currentRouteIdx] &&
		(config.routes[currentRouteIdx] as VercelHandler).handle !== phase
	) {
		currentRouteIdx++;
	}
	currentRouteIdx++;

	while (
		config.routes[currentRouteIdx] &&
		!(config.routes[currentRouteIdx] as VercelHandler).handle
	) {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		routes.push(config.routes[currentRouteIdx]!);
		currentRouteIdx++;
	}

	return routes;
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
	config.routes?.forEach(route => {
		if ('handle' in route) {
			currentPhase = route.handle;
		} else {
			processedConfig.routes[currentPhase].push(route);
		}
	});

	return processedConfig;
}
