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
): VercelSource[] {
	if (!routes.length) {
		return [];
	}

	const phaseStart = getPhaseStart(routes, phase);
	const phaseEnd = getPhaseEnd(routes, phaseStart);
	return routes.slice(phaseStart, phaseEnd) as VercelSource[];
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
		if (isVercelHandler(route)) {
			currentPhase = route.handle;
		} else {
			normalizeRouteSrc(route);
			processedConfig.routes[currentPhase].push(route);
		}
	});

	return processedConfig;
}

/**
 * Given a source route it normalizes its src value if needed.
 *
 * (In this context normalization means tweaking the src value so that it follows
 * a format which Vercel expects).
 *
 * Note: this function applies the change side-effectfully to the route object.
 *
 * @param route Route which src we want to potentially normalize
 */
function normalizeRouteSrc(route: VercelSource): void {
	if (!route.src) return;

	// we rely on locale root routes pointing to '/' to perform runtime checks
	// so we cannot normalize such src values as that would break things later on
	// see: https://github.com/cloudflare/next-on-pages/blob/654545/packages/next-on-pages/templates/_worker.js/routes-matcher.ts#L353-L358
	if (route.locale && route.src === '/') return;

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

export function isVercelHandler(route: VercelRoute): route is VercelHandler {
	return 'handle' in route;
}

/**
 * Discerns whether the target application is using the App Router or not based
 * on its Vercel config
 *
 * This is done by checking the presence of the "_app.rsc.json" override which is only
 * applied if the application is using the App router
 *
 * @param vercelConfig the Vercel config to analyze
 * @returns true if the application is using the App Router, false otherwise
 */
export function isUsingAppRouter(vercelConfig: VercelConfig): boolean {
	return !!vercelConfig.overrides?.['_app.rsc.json'];
}

/**
 * Discerns whether the target application is using the Pages Router or not based
 * on its Vercel config
 *
 * This is done by checking the presence of the "index.html" override which is only
 * applied if the application is using the Pages router
 *
 * @param vercelConfig the Vercel config to analyze
 * @returns true if the application is using the Pages Router, false otherwise
 */
export function isUsingPagesRouter(vercelConfig: VercelConfig): boolean {
	return !!vercelConfig.overrides?.['index.html'];
}
