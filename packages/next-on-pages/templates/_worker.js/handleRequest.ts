import type { MatchedSet } from './utils';
import { applyHeaders, isUrl, runOrFetchBuildOutputItem } from './utils';
import { RoutesMatcher } from './routes-matcher';
import type { RequestContext } from '../../src/utils/requestContext';

/**
 * Handles a request by processing and matching it against all the routing phases.
 *
 * @param reqCtx Request Context object (contains all we need in to know regarding the request in order to handle it).
 * @param config The processed Vercel build output config.
 * @param output Vercel build output.
 * @returns An instance of the router.
 */
export async function handleRequest(
	reqCtx: RequestContext,
	config: ProcessedVercelConfig,
	output: VercelBuildOutput,
): Promise<Response> {
	const matcher = new RoutesMatcher(
		config.routes,
		output,
		reqCtx,
		config.wildcard,
	);
	const match = await findMatch(matcher);

	return generateResponse(reqCtx, match, output);
}

/**
 * Finds a match for the request.
 *
 * @param matcher Instance of the matcher for the request.
 * @param phase The phase to run, either `none` or `error`.
 * @param skipErrorMatch Whether to skip the error match.
 * @returns The matched set of path, status, headers, and search params.
 */
async function findMatch(
	matcher: RoutesMatcher,
	phase: 'none' | 'error' = 'none',
	skipErrorMatch = false,
): Promise<MatchedSet> {
	const result = await matcher.run(phase);

	if (
		result === 'error' ||
		(!skipErrorMatch && matcher.status && matcher.status >= 400)
	) {
		return findMatch(matcher, 'error', true);
	}

	return {
		path: matcher.path,
		status: matcher.status,
		headers: matcher.headers,
		searchParams: matcher.searchParams,
		body: matcher.body,
	};
}

/**
 * Serves a file from the Vercel build output.
 *
 * @param reqCtx Request Context object.
 * @param match The match from the Vercel build output.
 * @returns A response object.
 */
async function generateResponse(
	reqCtx: RequestContext,
	{ path = '/404', status, headers, searchParams, body }: MatchedSet,
	output: VercelBuildOutput,
): Promise<Response> {
	// Redirect user to external URL for redirects.
	const locationHeader = headers.normal.get('location');
	if (locationHeader) {
		// Apply the search params to the location header if it was not from middleware.
		// Middleware that returns a redirect will specify the destination, including any search params
		// that they want to include. Therefore, we should not be appending search params to those.
		if (locationHeader !== headers.middlewareLocation) {
			const paramsStr = [...searchParams.keys()].length
				? `?${searchParams.toString()}`
				: '';
			headers.normal.set('location', `${locationHeader ?? '/'}${paramsStr}`);
		}

		return new Response(null, { status, headers: headers.normal });
	}

	let resp: Response;

	if (body !== undefined) {
		// If we have a response body from matching, use it instead.
		resp = new Response(body, { status });
	} else if (isUrl(path)) {
		// If the path is an URL from matching, that means it was rewritten to a full URL.
		resp = await fetch(new URL(path), reqCtx.request);
	} else {
		// Otherwise, we need to serve a file from the Vercel build output.
		resp = await runOrFetchBuildOutputItem(output[path], reqCtx, {
			path,
			status,
			headers,
			searchParams,
		});
	}

	const newHeaders = headers.normal;
	applyHeaders(newHeaders, resp.headers);
	applyHeaders(newHeaders, headers.important);

	resp = new Response(resp.body, {
		...resp,
		status: status || resp.status,
		headers: newHeaders,
	});

	return resp;
}
