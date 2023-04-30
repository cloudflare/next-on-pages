import {
	applyHeaders,
	createNewRequest,
	createNewResponse,
	applySearchParams,
} from './http';

export type MatchedSet = {
	path: string;
	status: number | undefined;
	headers: { normal: Headers; important: Headers };
	searchParams: URLSearchParams;
};

/**
 * Get the next phase of the routing process.
 *
 * @param phase Current phase of the routing process.
 * @returns Next phase of the routing process.
 */
export function getNextPhase(
	phase: keyof ProcessedVercelRoutes
): VercelHandleValue {
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
 * Run or fetch a build output item.
 *
 * @param item Build output item to run or fetch.
 * @param request Request object.
 * @param match Matched route details.
 * @param assets Fetcher for static assets.
 * @param ctx Execution context for the request.
 * @returns Response object.
 */
export async function runItem(
	item: VercelBuildOutputItem | undefined,
	request: Request,
	{ path, searchParams }: MatchedSet,
	assets: Fetcher,
	ctx: ExecutionContext
) {
	let resp: Response | undefined = undefined;

	// Apply the search params from matching the route to the request URL.
	const url = new URL(request.url);
	applySearchParams(searchParams, url.searchParams);
	const req = new Request(url, request);

	try {
		switch (item?.type) {
			case 'function': {
				resp = await (await item.entrypoint).default(req, ctx);
				break;
			}
			case 'override': {
				resp = createNewResponse(
					await assets.fetch(createNewRequest(req, item.path ?? path))
				);

				if (item.headers) {
					applyHeaders(item.headers, resp.headers);
				}
				break;
			}
			case 'static': {
				resp = await assets.fetch(createNewRequest(req, path));
				break;
			}
			case 'middleware': {
				resp = await (await item.entrypoint).default(req, ctx);
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

	return resp
		? // construct a new response as the original response might be immutable
		  createNewResponse(resp)
		: new Response('Not Found', { status: 404 });
}

/**
 * Process the response from running a middleware function.
 *
 * Handles rewriting the URL and applying redirects, response headers, and overriden request headers.
 *
 * @param resp Middleware response object.
 * @param req Request object.
 * @param url URL object.
 * @param currentMatch The current details for matching the route.
 * @returns Updated details for matching the route.
 */
export function processMiddlewareResp(
	resp: Response,
	req: Request,
	url: URL,
	currentMatch: Omit<MatchedSet, 'status'>
): Omit<MatchedSet, 'status'> {
	const { searchParams, headers } = currentMatch;
	let path = currentMatch.path;

	const overrideKey = 'x-middleware-override-headers';
	const overrideHeader = resp.headers.get(overrideKey);
	if (overrideHeader) {
		const overridenHeaderKeys = new Set(
			overrideHeader.split(',').map(h => h.trim())
		);

		for (const key of overridenHeaderKeys.keys()) {
			const valueKey = `x-middleware-request-${key}`;
			const value = resp.headers.get(valueKey);

			if (req.headers.get(key) !== value) {
				if (value) {
					req.headers.set(key, value);
				} else {
					req.headers.delete(key);
				}
			}

			resp.headers.delete(valueKey);
		}

		resp.headers.delete(overrideKey);
	}

	const rewriteKey = 'x-middleware-rewrite';
	const rewriteHeader = resp.headers.get(rewriteKey);
	if (rewriteHeader) {
		const newUrl = new URL(rewriteHeader, url);
		path = newUrl.pathname;
		applySearchParams(newUrl.searchParams, searchParams);

		resp.headers.delete(rewriteKey);
	}

	applyHeaders(resp.headers, headers.normal);

	return { path, searchParams, headers };
}
