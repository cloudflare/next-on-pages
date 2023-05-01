import type { MatchedSet } from './utils';
import { applyHeaders, runOrFetchBuildOutputItem } from './utils';
import { RoutesMatcher } from './matcher';

/**
 * The router is used to match and serve routes in the Vercel build output.
 */
export class Router {
	/** Processed routes from the Vercel build output config. */
	private routes: ProcessedVercelRoutes;

	/**
	 * Creates a new instance of the router.
	 *
	 * The router is used to match and serve routes in the Vercel build output.
	 *
	 * @param config The processed Vercel build output config.
	 * @param output Vercel build output.
	 * @param assets Static assets fetcher.
	 * @param ctx Execution context.
	 * @returns An instance of the router.
	 */
	constructor(
		config: ProcessedVercelConfig,
		/** Vercel build output. */
		private output: VercelBuildOutput,
		/** Static assets fetcher. */
		private assets: Fetcher,
		/** Execution context. */
		private ctx: ExecutionContext
	) {
		this.routes = config.routes;
	}

	/**
	 * Finds a match for the request.
	 *
	 * @param matcher Instance of the matcher for the request.
	 * @param phase The phase to run, either `none` or `error`.
	 * @param skipErrorMatch Whether to skip the error match.
	 * @returns The matched set of path, status, headers, and search params.
	 */
	private async findMatch(
		matcher: RoutesMatcher,
		phase: 'none' | 'error' = 'none',
		skipErrorMatch = false
	): Promise<MatchedSet> {
		const result = await matcher.run(phase);

		if (
			result === 'error' ||
			(!skipErrorMatch && matcher.status && matcher.status >= 400)
		) {
			return await this.findMatch(matcher, 'error', true);
		}

		return {
			path: matcher.path,
			status: matcher.status,
			headers: matcher.headers,
			searchParams: matcher.searchParams,
		};
	}

	/**
	 * Match a request to a route from the Vercel build output.
	 *
	 * @param req Request object.
	 * @returns The matched set of path, status, headers, and search params.
	 */
	public async match(req: Request): Promise<MatchedSet> {
		const matcher = new RoutesMatcher(
			this.routes,
			this.output,
			this.assets,
			this.ctx,
			req
		);

		return await this.findMatch(matcher);
	}

	/**
	 * Serves a file from the Vercel build output.
	 *
	 * @param req Request object.
	 * @param match The match from the Vercel build output.
	 * @returns A response object.
	 */
	public async serve(req: Request, match: MatchedSet): Promise<Response> {
		const { path = '/404', status, headers, searchParams } = match;

		// Redirect user to external URL for redirects.
		if (headers.normal.has('location')) {
			// Apply the search params to the location header.
			const location = headers.normal.get('location') ?? '/';
			const paramsStr = [...searchParams.keys()].length
				? `?${searchParams.toString()}`
				: '';
			headers.normal.set('location', `${location}${paramsStr}`);

			return new Response(null, { status, headers: headers.normal });
		}

		let resp = await runOrFetchBuildOutputItem(
			this.output[path],
			req,
			{ path, status, headers, searchParams },
			this.assets,
			this.ctx
		);

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
}
