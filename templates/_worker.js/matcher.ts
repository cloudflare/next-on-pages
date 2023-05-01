import { parse } from 'cookie';
import type { MatchPCREResult, MatchedSet } from './utils';
import {
	applyHeaders,
	applyPCREMatches,
	applySearchParams,
	getNextPhase,
	isUrl,
	runOrFetchBuildOutputItem,
	checkRouteMatch as checkRouteMatchUtility,
} from './utils';

export type CheckRouteStatus = 'skip' | 'next' | 'done' | 'error';
export type CheckPhaseStatus = Extract<CheckRouteStatus, 'error' | 'done'>;

export class Matcher {
	/** Processed routes from the Vercel build output config. */
	private routes: ProcessedVercelRoutes;
	/** Vercel build output. */
	private output: VercelBuildOutput;
	/** Static assets fetcher. */
	private assets: Fetcher;
	/** Execution context. */
	private ctx: ExecutionContext;

	/** Request to match */
	private req: Request;
	/** URL from the request to match */
	private url: URL;
	/** Cookies from the request to match */
	private cookies: Record<string, string>;

	/** Path for the matched route */
	public path: string;
	/** Status for the response object */
	public status: number | undefined;
	/** Headers for the response object */
	public headers: { normal: Headers; important: Headers };
	/** Search params for the response object */
	public searchParams: URLSearchParams;

	/**
	 * Creates a new instance of a request matcher.
	 *
	 * The matcher is used to match a request to a route and run the route's middleware.
	 *
	 * @param config The processed Vercel build output config.
	 * @param output Vercel build output.
	 * @param assets Static assets fetcher.
	 * @param ctx Execution context.
	 * @param req Request object.
	 * @param prevMatch The previous match from a routing phase to initialize the matcher with.
	 * @returns The matched set of path, status, headers, and search params.
	 */
	constructor(
		routes: ProcessedVercelRoutes,
		output: VercelBuildOutput,
		assets: Fetcher,
		ctx: ExecutionContext,
		req: Request,
		prevMatch?: MatchedSet
	) {
		this.routes = routes;
		this.output = output;
		this.assets = assets;
		this.ctx = ctx;

		this.req = req;
		this.url = new URL(req.url);
		this.cookies = parse(req.headers.get('cookie') || '');

		this.path = prevMatch?.path || this.url.pathname || '/';
		this.status = prevMatch?.status;
		this.headers = prevMatch?.headers || {
			normal: new Headers(),
			important: new Headers(),
		};
		this.searchParams = prevMatch?.searchParams || new URLSearchParams();
	}

	/**
	 * Checks if a Vercel source route from the build output config matches the request.
	 *
	 * @param route Build output config source route.
	 * @param checkStatus Whether to check the status code of the route.
	 * @returns The source path match result if the route matches, otherwise `undefined`.
	 */
	private checkRouteMatch(
		route: VercelSource,
		checkStatus?: boolean
	): MatchPCREResult | undefined {
		return checkRouteMatchUtility(route, this.path, {
			url: this.url,
			cookies: this.cookies,
			headers: this.req.headers,
			method: this.req.method,
			requiredStatus: checkStatus ? this.status : undefined,
		});
	}

	/**
	 * Processes the response from running a middleware function.
	 *
	 * Handles rewriting the URL and applying redirects, response headers, and overriden request headers.
	 *
	 * @param resp Middleware response object.
	 */
	private processMiddlewareResp(resp: Response): void {
		const overrideKey = 'x-middleware-override-headers';
		const overrideHeader = resp.headers.get(overrideKey);
		if (overrideHeader) {
			const overridenHeaderKeys = new Set(
				overrideHeader.split(',').map(h => h.trim())
			);

			for (const key of overridenHeaderKeys.keys()) {
				const valueKey = `x-middleware-request-${key}`;
				const value = resp.headers.get(valueKey);

				if (this.req.headers.get(key) !== value) {
					if (value) {
						this.req.headers.set(key, value);
					} else {
						this.req.headers.delete(key);
					}
				}

				resp.headers.delete(valueKey);
			}

			resp.headers.delete(overrideKey);
		}

		const rewriteKey = 'x-middleware-rewrite';
		const rewriteHeader = resp.headers.get(rewriteKey);
		if (rewriteHeader) {
			const newUrl = new URL(rewriteHeader, this.url);
			this.path = newUrl.pathname;
			applySearchParams(newUrl.searchParams, this.searchParams);

			resp.headers.delete(rewriteKey);
		}

		applyHeaders(resp.headers, this.headers.normal);
	}

	/**
	 * Runs the middleware function for a route if it exists.
	 *
	 * @param path Path to the route's middleware function.
	 * @returns Whether the middleware function was run successfully.
	 */
	private async runRouteMiddleware(path?: string): Promise<boolean> {
		// If there is no path, return true as it did not result in an error.
		if (!path) return true;

		const item = path && this.output[path];
		if (!item || item.type !== 'middleware') {
			// The middleware function could not be found. Set the status to 500 and bail out.
			this.status = 500;
			return false;
		}

		const resp = await runOrFetchBuildOutputItem(
			item,
			this.req,
			{
				path: this.path,
				searchParams: this.searchParams,
				headers: this.headers,
				status: this.status,
			},
			this.assets,
			this.ctx
		);

		if (resp.status >= 400) {
			// The middleware function errored. Set the status and bail out.
			this.status = resp.status;
			return false;
		}

		this.processMiddlewareResp(resp);
		return true;
	}

	/**
	 * Resets the response status and headers if the route should override them.
	 *
	 * @param route Build output config source route.
	 */
	private applyRouteOverrides(route: VercelSource): void {
		if (!route.override) return;

		this.status = undefined;
		this.headers.normal = new Headers();
		this.headers.important = new Headers();
	}

	/**
	 * Applies the route's headers for the response object.
	 *
	 * @param route Build output config source route.
	 * @param srcMatch Matches from the PCRE matcher.
	 * @param captureGroupKeys Named capture group keys from the PCRE matcher.
	 */
	private applyRouteHeaders(
		route: VercelSource,
		srcMatch: RegExpMatchArray,
		captureGroupKeys: string[]
	): void {
		if (!route.headers) return;

		applyHeaders(route.headers, this.headers.normal, {
			match: srcMatch,
			captureGroupKeys,
		});

		if (route.important) {
			applyHeaders(route.headers, this.headers.important, {
				match: srcMatch,
				captureGroupKeys,
			});
		}
	}

	/**
	 * Applies the route's status code for the response object.
	 *
	 * @param route Build output config source route.
	 */
	private applyRouteStatus(route: VercelSource): void {
		if (!route.status) return;

		this.status = route.status;
	}

	/**
	 * Applies the route's destination for the matching the path to the Vercel build output.
	 *
	 * @param route Build output config source route.
	 * @param srcMatch Matches from the PCRE matcher.
	 * @param captureGroupKeys Named capture group keys from the PCRE matcher.
	 * @returns The previous path for the route before applying the destination.
	 */
	private applyRouteDest(
		route: VercelSource,
		srcMatch: RegExpMatchArray,
		captureGroupKeys: string[]
	): string {
		if (!route.dest) return this.path;

		const prevPath = this.path;

		this.path = applyPCREMatches(route.dest, srcMatch, captureGroupKeys);

		// NOTE: Special handling for `/index` RSC routes. Sometimes the Vercel build output config
		// has a record to rewrite `^/` to `/index.rsc`, however, this will hit requests to pages
		// that aren't `/`. In this case, we should check that the previous path is `/`.
		if (/\/index\.rsc$/i.test(this.path) && !/\/(?:index)?$/i.test(prevPath)) {
			this.path = prevPath;
		}

		// NOTE: Special handling for `.rsc` requests. If the Vercel CLI failed to generate an RSC
		// version of the page and the build output config has a record mapping the request to the
		// RSC variant, we should strip the `.rsc` extension from the path.
		if (/\.rsc$/i.test(this.path) && !(this.path in this.output)) {
			this.path = this.path.replace(/\.rsc/i, '');
		}

		// If not an external URL, merge search params for later use.
		if (!isUrl(this.path)) {
			const destUrl = new URL(this.path, this.url);
			applySearchParams(destUrl.searchParams, this.searchParams);
			this.path = destUrl.pathname;
		}

		return prevPath;
	}

	/**
	 * Checks a route to see if it matches the current request.
	 *
	 * @param route Build output config source route.
	 * @param checkStatus Whether to check the status code for the route.
	 * @returns The status from checking the route.
	 */
	private async checkRoute(
		route: VercelSource,
		checkStatus?: boolean
	): Promise<CheckRouteStatus> {
		const routeMatch = this.checkRouteMatch(route, checkStatus);
		// If this route doesn't match, continue to the next one.
		if (!routeMatch?.match) return 'skip';
		const { match: srcMatch, captureGroupKeys } = routeMatch;

		// If this route overrides, replace the response headers and status.
		this.applyRouteOverrides(route);

		// Call and process the middleware if this is a middleware route.
		const success = await this.runRouteMiddleware(route?.middlewarePath);
		if (!success) return 'error';

		// Update final headers with the ones from this route.
		this.applyRouteHeaders(route, srcMatch, captureGroupKeys);

		// Update the status code if this route has one.
		this.applyRouteStatus(route);

		// Update the path with the new destination.
		const prevPath = this.applyRouteDest(route, srcMatch, captureGroupKeys);

		// If `check` is required and the path isn't an URL, check it again.
		if (route.check && !isUrl(this.path)) {
			if (prevPath === this.path) {
				// NOTE: If the current/rewritten path is the same as the one that entered the phase, it
				// can cause an infinite loop. Therefore, we should just set the status to `404` instead.
				// This happens with invalid `/_next/static/...` and `/_next/data/...` requests.
				this.status = 404;
			} else {
				return await this.checkPhase('filesystem');
			}
		}

		// If we found a match and shouldn't continue finding matches, break out of the loop.
		if (!route.continue) {
			return 'done';
		}

		return 'next';
	}

	/**
	 * Checks a phase from the routing process to see if any routes match the current request.
	 *
	 * @param phase Current phase for routing.
	 * @returns The status from checking the phase.
	 */
	private async checkPhase(
		phase: keyof ProcessedVercelRoutes
	): Promise<CheckPhaseStatus> {
		let shouldContinue = true;

		for (const route of this.routes[phase]) {
			const result = await this.checkRoute(route, phase === 'error');

			switch (result) {
				case 'skip':
					continue;
				case 'done':
					shouldContinue = false;
					break;
				case 'error':
					return 'error';
				case 'next':
					break;
			}

			if (!shouldContinue) {
				break;
			}
		}

		// In the `hit` phase or for external urls/redirects, return the match.
		if (
			phase === 'hit' ||
			isUrl(this.path) ||
			(!shouldContinue && this.headers.normal.has('location'))
		) {
			return 'done';
		}

		// In the `miss` phase, set status to 404 if no path was found and it isn't an error code.
		const pathExistsInOutput = this.path in this.output;
		if (phase === 'miss' && !pathExistsInOutput) {
			this.status = !this.status || this.status < 400 ? 404 : this.status;
		}

		let nextPhase: VercelHandleValue = 'miss';
		if (pathExistsInOutput || phase === 'miss' || phase === 'error') {
			// If the route exists, enter the `hit` phase. For `miss` and `error` phases, enter the `hit`
			// phase to update headers (e.g. `x-matched-path`).
			nextPhase = 'hit';
		} else if (shouldContinue) {
			nextPhase = getNextPhase(phase);
		}

		return await this.checkPhase(nextPhase);
	}

	/**
	 * Runs the matcher for a phase.
	 *
	 * @param phase The phase to start matching routes from.
	 * @returns The status from checking for matches.
	 */
	public async run(
		phase: Extract<keyof ProcessedVercelRoutes, 'none' | 'error'> = 'none'
	): Promise<CheckPhaseStatus> {
		const result = await this.checkPhase(phase);

		// Check if path is an external URL.
		if (isUrl(this.path)) this.headers.normal.set('location', this.path);

		// Update status to redirect user to external URL.
		if (this.headers.normal.has('location')) {
			if (!this.status || this.status < 300 || this.status >= 400) {
				this.status = 307;
			}
		}

		return result;
	}
}
