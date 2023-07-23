import type { RequestContext } from '../../../src/utils/requestContext';
import {
	applyHeaders,
	createRouteRequest,
	createMutableResponse,
	applySearchParams,
} from './http';

export type MatchedSetHeaders = {
	/**
	 * The headers present on a source route.
	 * Gets applied to the final response before the response headers from running a function.
	 */
	normal: Headers;
	/**
	 * The *important* headers - the ones present on a source route that specifies `important: true`.
	 * Gets applied to the final response after the response headers from running a function.
	 */
	important: Headers;
	/**
	 * Tracks if a location header is found, and what the value is, after running a middleware function.
	 */
	middlewareLocation?: string | null;
};

export type MatchedSet = {
	path: string;
	status: number | undefined;
	headers: MatchedSetHeaders;
	searchParams: URLSearchParams;
	body: BodyInit | undefined | null;
};

/**
 * Gets the next phase of the routing process.
 *
 * Determines which phase should follow the `none`, `filesystem`, `rewrite`, or `resource` phases.
 * Falls back to `miss`.
 *
 * @param phase Current phase of the routing process.
 * @returns Next phase of the routing process.
 */
export function getNextPhase(phase: VercelPhase): VercelHandleValue {
	switch (phase) {
		// `none` applied headers/redirects/middleware/`beforeFiles` rewrites. It checked non-dynamic routes and static assets.
		case 'none': {
			return 'filesystem';
		}
		// `filesystem` applied `afterFiles` rewrites. It checked those rewritten routes.
		case 'filesystem': {
			return 'rewrite';
		}
		// `rewrite` applied dynamic params to requests. It checked dynamic routes.
		case 'rewrite': {
			return 'resource';
		}
		// `resource` applied `fallback` rewrites. It checked the final routes.
		case 'resource': {
			return 'miss';
		}
		default: {
			return 'miss';
		}
	}
}

/**
 * Runs or fetches a build output item.
 *
 * @param item Build output item to run or fetch.
 * @param request Request object.
 * @param match Matched route details.
 * @param assets Fetcher for static assets.
 * @param ctx Execution context for the request.
 * @returns Response object.
 */
export async function runOrFetchBuildOutputItem(
	item: VercelBuildOutputItem | undefined,
	{ request, assetsFetcher, ctx }: RequestContext,
	{ path, searchParams }: Omit<MatchedSet, 'body'>,
) {
	let resp: Response | undefined = undefined;

	// Apply the search params from matching the route to the request URL.
	const url = new URL(request.url);
	applySearchParams(url.searchParams, searchParams);
	const req = new Request(url, request);

	try {
		switch (item?.type) {
			case 'function':
			case 'middleware': {
				const edgeFunction: EdgeFunction = await import(item.entrypoint);
				resp = await edgeFunction.default(req, ctx);
				break;
			}
			case 'override': {
				resp = createMutableResponse(
					await assetsFetcher.fetch(createRouteRequest(req, item.path ?? path)),
				);

				if (item.headers) {
					applyHeaders(resp.headers, item.headers);
				}
				break;
			}
			case 'static': {
				resp = await assetsFetcher.fetch(createRouteRequest(req, path));
				break;
			}
			default: {
				resp = new Response('Not Found', { status: 404 });
			}
		}
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return new Response('Internal Server Error', { status: 500 });
	}

	return createMutableResponse(resp);
}

/**
 * Checks if a source route's matcher uses the regex format for locales with a trailing slash, where
 * the locales specified are known.
 *
 * Determines whether a matcher is in the format of `^//?(?:en|fr|nl)/(.*)`.
 *
 * @param src Source route `src` regex value.
 * @param locales Known available locales.
 * @returns Whether the source route matches the regex for a locale with a trailing slash.
 */
export function isLocaleTrailingSlashRegex(
	src: string,
	locales: Record<string, string>,
) {
	const prefix = '^//?(?:';
	const suffix = ')/(.*)';

	if (!src.startsWith(prefix) || !src.endsWith(suffix)) {
		return false;
	}

	const foundLocales = src.slice(prefix.length, -suffix.length).split('|');
	return foundLocales.every(locale => locale in locales);
}
