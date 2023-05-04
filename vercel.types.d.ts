/**
 * Types for the Vercel build output configuration file.
 */

type VercelConfig = {
	version: 3;
	routes?: VercelRoute[];
	images?: VercelImagesConfig;
	wildcard?: VercelWildcardConfig;
	overrides?: VercelOverrideConfig;
	framework?: { version: string };
	cache?: string[];
	crons?: VercelCronsConfig;
};

type VercelRoute = VercelSource | VercelHandler;

type VercelSource = {
	src: string;
	dest?: string;
	headers?: Record<string, string>;
	methods?: string[];
	continue?: boolean;
	override?: boolean;
	important?: boolean;
	caseSensitive?: boolean;
	check?: boolean;
	status?: number;
	has?: VercelHasFields;
	missing?: VercelHasFields;
	locale?: VercelLocale;
	middlewarePath?: string;
	middlewareRawSrc?: string[];
};

type VercelHasField =
	| VercelHostHasField
	| VercelHeaderHasField
	| VercelCookieHasField
	| VercelQueryHasField;

type VercelHasFields = Array<VercelHasField>;

type VercelLocale = {
	redirect?: Record<string, string>;
	cookie?: string;
};

type VercelHostHasField = {
	type: 'host';
	value: string;
};

type VercelHeaderHasField = {
	type: 'header';
	key: string;
	value?: string;
};

type VercelCookieHasField = {
	type: 'cookie';
	key: string;
	value?: string;
};

type VercelQueryHasField = {
	type: 'query';
	key: string;
	value?: string;
};

type VercelHandleValue =
	| 'rewrite'
	| 'filesystem' // check matches after the filesystem misses
	| 'resource'
	| 'miss' // check matches after every filesystem miss
	| 'hit'
	| 'error'; //  check matches after error (500, 404, etc.)

type VercelHandler = {
	handle: VercelHandleValue;
	src?: string;
	dest?: string;
	status?: number;
};

type VercelImageFormat = 'image/avif' | 'image/webp';

type VercelImagesConfig = {
	sizes: number[];
	domains: string[];
	remotePatterns?: string[];
	minimumCacheTTL?: number; // seconds
	formats?: VercelImageFormat[];
	dangerouslyAllowSVG?: boolean;
	contentSecurityPolicy?: string;
	contentDispositionType?: string;
};

type VercelWildCard = {
	domain: string;
	value: string;
};

type VercelWildcardConfig = Array<VercelWildCard>;

type VercelOverride = {
	path?: string;
	contentType?: string;
};

type VercelOverrideConfig = Record<string, VercelOverride>;

type VercelCron = {
	path: string;
	schedule: string;
};

type VercelCronsConfig = VercelCron[];

/**
 * Types for the processed Vercel build output (config, functions + static assets).
 */

type Override<T, K extends keyof T, V> = Omit<T, K> & { [key in K]: V };

type ProcessedVercelRoutes = {
	none: VercelSource[];
	filesystem: VercelSource[];
	miss: VercelSource[];
	rewrite: VercelSource[];
	resource: VercelSource[];
	hit: VercelSource[];
	error: VercelSource[];
};
type VercelPhase = keyof ProcessedVercelRoutes;

type ProcessedVercelConfig = Override<
	VercelConfig,
	'routes',
	ProcessedVercelRoutes
>;

type BuildOutputStaticAsset = { type: 'static' };
type BuildOutputStaticOverride = {
	type: 'override';
	path: string;
	headers?: Record<string, string>;
};
type BuildOutputStaticItem = BuildOutputStaticAsset | BuildOutputStaticOverride;

type BuildOutputFunction = {
	type: 'function' | 'middleware';
	entrypoint: string;
};

type BuildOutputItem = BuildOutputFunction | BuildOutputStaticItem;
type ProcessedVercelBuildOutput = Map<string, BuildOutputItem>;

type EdgeFunction = {
	default: (
		request: Request,
		context: ExecutionContext
	) => Response | Promise<Response>;
};

type AdjustedBuildOutputFunction = Override<
	BuildOutputFunction,
	'entrypoint',
	Promise<EdgeFunction>
>;
type VercelBuildOutputItem =
	| AdjustedBuildOutputFunction
	| BuildOutputStaticItem;

type VercelBuildOutput = {
	[key: string]: VercelBuildOutputItem;
};
