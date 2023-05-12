import type { RequestContext } from '../../../src/utils/requestContext';
import {
	applyHeaders,
	createRouteRequest,
	createMutableResponse,
	applySearchParams,
} from './http';

export type MatchedSet = {
	path: string;
	status: number | undefined;
	headers: { normal: Headers; important: Headers };
	searchParams: URLSearchParams;
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
	{ path, searchParams }: MatchedSet
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
					await assetsFetcher.fetch(createRouteRequest(req, item.path ?? path))
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
