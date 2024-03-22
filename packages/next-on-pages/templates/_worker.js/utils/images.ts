import { applyHeaders, createMutableResponse } from './http';

/**
 * Checks whether the given URL matches the given remote pattern from the Vercel build output
 * images configuration.
 *
 * https://vercel.com/docs/build-output-api/v3/configuration#images
 *
 * @param url URL to check.
 * @param pattern Remote pattern to match against.
 * @returns Whether the URL matches the remote pattern.
 */
export function isRemotePatternMatch(
	url: URL,
	{ protocol, hostname, port, pathname }: VercelImageRemotePattern,
): boolean {
	// Protocol must match if defined.
	if (protocol && url.protocol.replace(/:$/, '') !== protocol) return false;
	// Hostname must match regexp.
	if (!new RegExp(hostname).test(url.hostname)) return false;
	// Port must match regexp if defined.
	if (port && !new RegExp(port).test(url.port)) return false;
	// Pathname must match regexp if defined.
	if (pathname && !new RegExp(pathname).test(url.pathname)) return false;
	// All checks passed.
	return true;
}

type ResizingProperties = {
	isRelative: boolean;
	imageUrl: URL;
	options: RequestInitCfPropertiesImage;
};

/**
 * Derives the properties to use for image resizing from the incoming request, respecting the
 * images configuration spec from the Vercel build output config.
 *
 * https://vercel.com/docs/build-output-api/v3/configuration#images
 *
 * @param request Incoming request.
 * @param config Images configuration from the Vercel build output.
 * @returns Resizing properties if the request is valid, otherwise undefined.
 */
export function getResizingProperties(
	request: Request,
	config?: VercelImagesConfig,
): ResizingProperties | undefined {
	if (request.method !== 'GET') return undefined;

	const { origin, searchParams } = new URL(request.url);

	const rawUrl = searchParams.get('url');
	const width = Number.parseInt(searchParams.get('w') ?? '', 10);
	// 75 is the default quality - https://nextjs.org/docs/app/api-reference/components/image#quality
	const quality = Number.parseInt(searchParams.get('q') ?? '75', 10);

	if (!rawUrl || Number.isNaN(width) || Number.isNaN(quality)) return undefined;
	if (!config?.sizes?.includes(width)) return undefined;
	if (quality < 0 || quality > 100) return undefined;

	const url = new URL(rawUrl, origin);

	// SVGs must be allowed by the config.
	if (url.pathname.endsWith('.svg') && !config?.dangerouslyAllowSVG) {
		return undefined;
	}

	const isProtocolRelative = rawUrl.startsWith('//');
	const isRelative = rawUrl.startsWith('/') && !isProtocolRelative;

	if (
		// Relative URL means same origin as deployment and is allowed.
		!isRelative &&
		// External image URL must be allowed by domains or remote patterns.
		!config?.domains?.includes(url.hostname) &&
		!config?.remotePatterns?.find(pattern => isRemotePatternMatch(url, pattern))
	) {
		return undefined;
	}

	const acceptHeader = request.headers.get('Accept') ?? '';
	const format = config?.formats
		?.find(format => acceptHeader.includes(format))
		?.replace('image/', '') as VercelImageFormatWithoutPrefix | undefined;

	return {
		isRelative,
		imageUrl: url,
		options: { width, quality, format },
	};
}

/**
 * Formats the given response to match the images configuration spec from the Vercel build output
 * config.
 *
 * Applies headers for `Content-Security-Policy` and `Content-Disposition`, if defined in the config.
 *
 * https://vercel.com/docs/build-output-api/v3/configuration#images
 *
 * @param resp Response to format.
 * @param imageUrl Image URL that was resized.
 * @param config Images configuration from the Vercel build output.
 * @returns Formatted response.
 */
export function formatResp(
	resp: Response,
	imageUrl: URL,
	config?: VercelImagesConfig,
): Response {
	const newHeaders = new Headers();

	if (config?.contentSecurityPolicy) {
		newHeaders.set('Content-Security-Policy', config.contentSecurityPolicy);
	}

	if (config?.contentDispositionType) {
		const fileName = imageUrl.pathname.split('/').pop();
		const contentDisposition = fileName
			? `${config.contentDispositionType}; filename="${fileName}"`
			: config.contentDispositionType;

		newHeaders.set('Content-Disposition', contentDisposition);
	}

	if (!resp.headers.has('Cache-Control')) {
		// Fall back to the minimumCacheTTL value if there is no Cache-Control header.
		// https://vercel.com/docs/concepts/image-optimization#caching
		newHeaders.set(
			'Cache-Control',
			`public, max-age=${config?.minimumCacheTTL ?? 60}`,
		);
	}

	const mutableResponse = createMutableResponse(resp);
	applyHeaders(mutableResponse.headers, newHeaders);

	return mutableResponse;
}

/**
 * Handles image resizing requests.
 *
 * @param request Incoming request.
 * @param config Images configuration from the Vercel build output.
 * @returns Resized image response if the request is valid, otherwise a 400 response.
 */
export async function handleImageResizingRequest(
	request: Request,
	{ buildOutput, assetsFetcher, imagesConfig }: ImageResizingOpts,
): Promise<Response> {
	const opts = getResizingProperties(request, imagesConfig);

	if (!opts) {
		return new Response('Invalid image resizing request', { status: 400 });
	}

	const { isRelative, imageUrl } = opts;

	// TODO: implement proper image resizing

	const imgFetch =
		isRelative && imageUrl.pathname in buildOutput
			? assetsFetcher.fetch.bind(assetsFetcher)
			: fetch;

	const imageResp = await imgFetch(imageUrl);

	return formatResp(imageResp, imageUrl, imagesConfig);
}

type ImageResizingOpts = {
	buildOutput: VercelBuildOutput;
	assetsFetcher: Fetcher;
	imagesConfig?: VercelImagesConfig;
};
