import { resolve } from 'path';
import { validateFile } from '../utils';
import * as os from 'os';

/**
 * The type of object a next.config.js file yields.
 *
 * Note: in the Next.js codebase they have a more complex/proper type for this, here we have a very simplified
 * version of it which includes just what we need in next-on-pages.
 */
export type NextConfig = Record<string, unknown> & {
	experimental?: {
		incrementalCacheHandlerPath?: string;
		allowedRevalidateHeaderKeys?: string[];
		fetchCacheKeyPrefix?: string;
	};
};

/**
 * Gets the user defined next config object (from their next.config.(m)js file).
 *
 * Note: If the user defined their config file by exporting a factory function, the
 * function is appropriately used and the resulting config object is returned.
 *
 * @returns the user defined next config object or null if such object could not be obtained (meaning that no next.config.(m)js file was found)
 */
export async function getNextConfig(): Promise<NextConfig | null> {
	const configFilePath =
		(await getConfigFilePath('js')) || (await getConfigFilePath('mjs'));

	if (!configFilePath) {
		return null;
	}

	const configObjOrFn = await import(configFilePath).then(m => m.default);

	const configObj =
		typeof configObjOrFn === 'function'
			? configObjOrFn(PHASE_PRODUCTION_BUILD, { defaultConfig })
			: configObjOrFn;

	return configObj;
}

/**
 * Gets the path of a next.config file present in the current directory if present.
 *
 * @param extension the config file extension (either 'js' or 'mjs')
 * @returns the path of the file if it was found, null otherwise
 */
async function getConfigFilePath(
	extension: 'js' | 'mjs',
): Promise<string | null> {
	const nextConfigJsPath = resolve(`next.config.${extension}`);
	const nextConfigJsFound = await validateFile(nextConfigJsPath);
	if (nextConfigJsFound) {
		return nextConfigJsPath;
	}
	return null;
}

// https://github.com/vercel/next.js/blob/0fc1d9e9/packages/next/src/shared/lib/constants.ts#L37
const PHASE_PRODUCTION_BUILD = 'phase-production-build';

// https://github.com/vercel/next.js/blob/0fc1d9e9/packages/next/src/server/config-shared.ts#L701-L815
const defaultConfig = {
	env: {},
	webpack: null,
	eslint: {
		ignoreDuringBuilds: false,
	},
	typescript: {
		ignoreBuildErrors: false,
		tsconfigPath: 'tsconfig.json',
	},
	distDir: '.next',
	cleanDistDir: true,
	assetPrefix: '',
	configOrigin: 'default',
	useFileSystemPublicRoutes: true,
	generateBuildId: () => null,
	generateEtags: true,
	pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
	poweredByHeader: true,
	compress: true,
	analyticsId: process.env['VERCEL_ANALYTICS_ID'] || '',
	images: {
		deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
		imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
		path: '/_next/image',
		loader: 'default',
		loaderFile: '',
		domains: [],
		disableStaticImages: false,
		minimumCacheTTL: 60,
		formats: ['image/webp'],
		dangerouslyAllowSVG: false,
		contentSecurityPolicy: `script-src 'none'; frame-src 'none'; sandbox;`,
		contentDispositionType: 'inline',
		remotePatterns: [],
		unoptimized: false,
	},
	devIndicators: {
		buildActivity: true,
		buildActivityPosition: 'bottom-right',
	},
	onDemandEntries: {
		maxInactiveAge: 60 * 1000,
		pagesBufferLength: 5,
	},
	amp: {
		canonicalBase: '',
	},
	basePath: '',
	sassOptions: {},
	trailingSlash: false,
	i18n: null,
	productionBrowserSourceMaps: false,
	optimizeFonts: true,
	excludeDefaultMomentLocales: true,
	serverRuntimeConfig: {},
	publicRuntimeConfig: {},
	reactProductionProfiling: false,
	reactStrictMode: null,
	httpAgentOptions: {
		keepAlive: true,
	},
	outputFileTracing: true,
	staticPageGenerationTimeout: 60,
	swcMinify: true,
	output: process.env['NEXT_PRIVATE_STANDALONE'] ? 'standalone' : undefined,
	modularizeImports: undefined,
	experimental: {
		windowHistorySupport: false,
		serverMinification: true,
		serverSourceMaps: false,
		caseSensitiveRoutes: false,
		useDeploymentId: false,
		deploymentId: undefined,
		useDeploymentIdServerActions: false,
		appDocumentPreloading: undefined,
		clientRouterFilter: true,
		clientRouterFilterRedirects: false,
		fetchCacheKeyPrefix: '',
		middlewarePrefetch: 'flexible',
		optimisticClientCache: true,
		manualClientBasePath: false,
		cpus: Math.max(
			1,
			(Number(process.env['CIRCLE_NODE_TOTAL']) ||
				(os.cpus() || { length: 1 }).length) - 1,
		),
		memoryBasedWorkersCount: false,
		isrFlushToDisk: true,
		workerThreads: false,
		proxyTimeout: undefined,
		optimizeCss: false,
		nextScriptWorkers: false,
		scrollRestoration: false,
		externalDir: false,
		disableOptimizedLoading: false,
		gzipSize: true,
		craCompat: false,
		esmExternals: true,
		isrMemoryCacheSize: 50 * 1024 * 1024,
		incrementalCacheHandlerPath: undefined,
		fullySpecified: false,
		outputFileTracingRoot: process.env['NEXT_PRIVATE_OUTPUT_TRACE_ROOT'] || '',
		swcTraceProfiling: false,
		forceSwcTransforms: false,
		swcPlugins: undefined,
		largePageDataBytes: 128 * 1000,
		disablePostcssPresetEnv: undefined,
		amp: undefined,
		urlImports: undefined,
		adjustFontFallbacks: false,
		adjustFontFallbacksWithSizeAdjust: false,
		turbo: undefined,
		turbotrace: undefined,
		typedRoutes: false,
		instrumentationHook: false,
		bundlePagesExternals: false,
		ppr:
			process.env['__NEXT_TEST_MODE'] &&
			process.env['__NEXT_EXPERIMENTAL_PPR'] === 'true'
				? true
				: false,
		webpackBuildWorker: undefined,
	},
};

/**
 * Given a raw nextConfig object it extracts the data from it that we'd want to save as build metadata
 * (for later runtime usage).
 *
 * @param nextConfig the raw config object obtained from a next.config.js file
 * @returns the extracted config build metadata
 */
export function extractBuildMetadataConfig(
	nextConfig: NextConfig,
): NonNullable<NextOnPagesBuildMetadata['config']> {
	const config: NonNullable<NextOnPagesBuildMetadata['config']> = {};

	if (nextConfig.experimental) {
		config.experimental = {
			allowedRevalidateHeaderKeys:
				nextConfig.experimental.allowedRevalidateHeaderKeys,
			fetchCacheKeyPrefix: nextConfig.experimental.fetchCacheKeyPrefix,
		};
	}

	return config;
}
