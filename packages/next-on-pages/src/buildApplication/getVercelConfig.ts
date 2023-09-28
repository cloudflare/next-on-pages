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
			`Unknown '${configPath}' version. Expected ${supportedConfigVersion} but found ${config.version}.`,
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
	routes: VercelRoute[],
	phase: VercelPhase,
): VercelRoute[] {
	if (!routes.length) {
		return [];
	}

	const phaseStart = getPhaseStart(routes, phase);
	const phaseEnd = getPhaseEnd(routes, phaseStart);
	return routes.slice(phaseStart, phaseEnd);
}

function getPhaseStart(routes: VercelRoute[], phase: VercelPhase): number {
	if (phase === 'none') {
		return 0;
	}

	const index = routes.findIndex(
		route => isVercelHandler(route) && route.handle === phase,
	);
	return index === -1 ? routes.length : index + 1;
}

function getPhaseEnd(routes: VercelRoute[], phaseStart: number): number {
	const index = routes.findIndex(
		(route, i) => i >= phaseStart && isVercelHandler(route),
	);
	return index === -1 ? routes.length : index;
}

export function processVercelConfig(
	config: VercelConfig,
): ProcessedVercelConfig {
	const processedConfig: ProcessedVercelConfig = {
		...structuredClone(config),
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
		// Vercel output routes sometimes include `$`s and sometimes they do not, but it seems
		// like in either case Vercel behaves as if they're present, so we need to mimic such behavior
		if (
			route.src &&
			!route.src.endsWith('$') &&
			route.src !== '/' &&
			!route.src.endsWith('(.*)')
		) {
			route.src += '$';
		}

		if (isVercelHandler(route)) {
			currentPhase = route.handle;
		} else {
			processedConfig.routes[currentPhase].push(route);
		}
	});

	return processedConfig;
}

function isVercelHandler(route: VercelRoute): route is VercelHandler {
	return 'handle' in route;
}
