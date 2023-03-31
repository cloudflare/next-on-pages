type VercelConfig = {
	version: 3;
	routes?: VercelRoute[];
	images?: VercelImagesConfig;
	wildcard?: VercelWildcardConfig;
	overrides?: VercelOverrideConfig;
	cache?: string[];
};

type VercelRoute = VercelSource | VercelHandler;

type VercelSource = {
	src: string;
	dest?: string;
	headers?: Record<string, string>;
	methods?: string[];
	continue?: boolean;
	caseSensitive?: boolean;
	check?: boolean;
	status?: number;
	has?: VercelHasFields;
	missing?: VercelHasFields;
	locale?: VercelLocale;
	middlewarePath?: string;
};

type VercelHasFields = Array<
	| VercelHostHasField
	| VercelHeaderHasField
	| VercelCookieHasField
	| VercelQueryHasField
>;

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
	minimumCacheTTL?: number; // seconds
	formats?: VercelImageFormat[];
	dangerouslyAllowSVG?: boolean;
	contentSecurityPolicy?: string;
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
