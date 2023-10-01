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
		...JSON.parse(JSON.stringify(config)),
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
		// The following src tweaks apply only on non-handler routes
		// see: https://github.com/vercel/vercel/blob/ea5bc88/packages/routing-utils/src/index.ts#L58
		const isHandler = isVercelHandler(route);

		// routes pointing to '/' with a locale might need not to be tweaked (as suggested by one of our i18n tests)
		// so just to be on the safe side we also skip those (note that this might actually be unnecessary)
		const isLocaleIndex = !isHandler && !!(route.locale && route.src === '/');

		if (route.src && !isHandler && !isLocaleIndex) {
			// Route src should always start with a '^'
			// see: https://github.com/vercel/vercel/blob/ea5bc88/packages/routing-utils/src/index.ts#L77
			if (!route.src.startsWith('^')) {
				route.src = `^${route.src}`;
			}

			// Route src should always end with a '$'
			// see: https://github.com/vercel/vercel/blob/ea5bc88/packages/routing-utils/src/index.ts#L82
			if (!route.src.endsWith('$')) {
				route.src = `${route.src}$`;
			}
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
