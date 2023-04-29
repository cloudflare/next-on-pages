import { parse } from 'cookie';
import type { MatchedSet } from './utils';
import {
	applyHeaders,
	applyPCREMatches,
	applySearchParams,
	checkRouteMatch,
	getNextPhase,
	isUrl,
	processMiddlewareResp,
	runItem,
} from './utils';

/**
 * Create a new instance of the router.
 *
 * The router is used to match and serve routes in the Vercel build output.
 *
 * @param args.routes Routes from the processed Vercel build output config.
 * @param output Vercel build output.
 * @param assets Static assets fetcher.
 * @param ctx Execution context.
 * @returns Functions to match and serve routes.
 */
export function router(
	{ routes }: ProcessedVercelConfig,
	output: VercelBuildOutput,
	assets: Fetcher,
	ctx: ExecutionContext
) {
	/**
	 * Match a request to a route from the Vercel build output.
	 *
	 * @param phase Current phase for routing.
	 * @param req Request object.
	 * @param url URL object for the request.
	 * @param cookies Cookies for the request.
	 * @param prevMatch The previous match from a routing phase.
	 * @param requiredStatus The required status code to use in matching.
	 * @returns The matched set of path, status, headers, and search params.
	 */
	async function matcher(
		phase: keyof ProcessedVercelRoutes,
		req: Request,
		url: URL,
		cookies: Record<string, string>,
		prevMatch?: MatchedSet,
		requiredStatus?: number
	): Promise<MatchedSet> {
		let path = prevMatch?.path || url.pathname || '/';
		let status = prevMatch?.status;
		let headers = prevMatch?.headers || {
			normal: new Headers(),
			important: new Headers(),
		};
		let searchParams = prevMatch?.searchParams || new URLSearchParams();

		let prevPath = path;
		let shouldContinue = true;

		for (const route of routes[phase]) {
			const routeMatch = checkRouteMatch(route, path, {
				url,
				cookies,
				headers: req.headers,
				method: req.method,
				requiredStatus,
			});
			// If this route doesn't match, continue to the next one.
			if (!routeMatch?.match) continue;
			const { match: srcMatch, captureGroupKeys } = routeMatch;

			// If this route overrides, replace the response headers and status.
			if (route.override) {
				status = undefined;
				headers.normal = new Headers();
				headers.important = new Headers();
			}

			// Call and process the middleware if this is a middleware route.
			if (route.middlewarePath) {
				const middlewareItem = output[route.middlewarePath];

				if (!middlewareItem || middlewareItem.type !== 'middleware') {
					// The middleware function could not be found. Set the status to 500 and bail out.
					status = 500;
					return { path, status, headers, searchParams };
				}

				const middlewareResp = await runItem(
					middlewareItem,
					req,
					{ path, status, headers, searchParams },
					assets,
					ctx
				);

				if (middlewareResp.status >= 400) {
					// The middleware function errored. Set the status and bail out.
					status = middlewareResp.status;
					return { path, status, headers, searchParams };
				}

				const result = processMiddlewareResp(middlewareResp, req, url, {
					path,
					headers,
					searchParams,
				});

				path = result.path;
				headers = result.headers;
				searchParams = result.searchParams;
			}

			// Update final headers with the ones from this route.
			if (route.headers) {
				applyHeaders(route.headers, headers.normal, {
					match: srcMatch,
					captureGroupKeys,
				});

				if (route.important) {
					applyHeaders(route.headers, headers.important, {
						match: srcMatch,
						captureGroupKeys,
					});
				}
			}

			// Update the status code if this route has one.
			if (route.status) {
				status = route.status;
			}

			// Update the path with the new destination.
			if (route.dest) {
				prevPath = path;
				path = applyPCREMatches(route.dest, srcMatch, captureGroupKeys);

				// NOTE: Special handling for `/index` RSC routes. Sometimes the Vercel build output config
				// has a record to rewrite `^/` to `/index.rsc`, however, this will hit requests to pages
				// that aren't `/`. In this case, we should check that the previous path is `/`.
				if (/\/index\.rsc$/i.test(path) && !/\/(?:index)?$/i.test(prevPath)) {
					path = prevPath;
				}

				// NOTE: Special handling for `.rsc` requests. If the Vercel CLI failed to generate an RSC
				// version of the page and the build output config has a record mapping the request to the
				// RSC variant, we should strip the `.rsc` extension from the path.
				if (/\.rsc$/i.test(path) && !(path in output)) {
					path = path.replace(/\.rsc/i, '');
				}

				// If not an external URL, merge search params for later use.
				if (!isUrl(path)) {
					const destUrl = new URL(path, url);
					applySearchParams(destUrl.searchParams, searchParams);
					path = destUrl.pathname;
				}
			}

			// If `check` is required and the path isn't an URL, check it again.
			if (route.check && !isUrl(path)) {
				if (prevPath === path) {
					// NOTE: If the current/rewritten path is the same as the one that entered the phase, it
					// can cause an infinite loop. Therefore, we should just set the status to `404` instead.
					// This happens with invalid `/_next/static/...` and `/_next/data/...` requests.
					status = 404;
				} else {
					return await matcher('filesystem', req, url, cookies, {
						path,
						status,
						headers,
						searchParams,
					});
				}
			}

			// If we found a match and shouldn't continue finding matches, break out of the loop.
			if (!route.continue) {
				shouldContinue = false;
				break;
			}
		}

		// In the `hit` phase or for external urls/redirects, return the match.
		if (
			phase === 'hit' ||
			isUrl(path) ||
			(!shouldContinue && headers.normal.has('location'))
		) {
			return {
				path,
				status,
				headers,
				searchParams,
			};
		}

		// In the `miss` phase, set status to 404 if no path was found and it isn't an error code.
		const pathExistsInOutput = path in output;
		if (phase === 'miss' && !pathExistsInOutput) {
			status = !status || status < 400 ? 404 : status;
		}

		let nextPhase: VercelHandleValue = 'miss';
		if (pathExistsInOutput || phase === 'miss' || phase === 'error') {
			// If the route exists, enter the `hit` phase. For `miss` and `error` phases, enter the `hit`
			// phase to update headers (e.g. `x-matched-path`).
			nextPhase = 'hit';
		} else if (shouldContinue) {
			nextPhase = getNextPhase(phase);
		}

		return await matcher(nextPhase, req, url, cookies, {
			path,
			status,
			headers,
			searchParams,
		});
	}

	/**
	 * Serves a file from the Vercel build output.
	 *
	 * @param req Request object.
	 * @param prevMatch The match from the Vercel build output.
	 * @param skipErrorMatch Whether to skip the error matching part of serving a file.
	 * @returns A response object.
	 */
	async function serve(
		req: Request,
		prevMatch: MatchedSet,
		skipErrorMatch = false
	): Promise<Response> {
		const { path = '/404', headers, searchParams } = prevMatch;
		let status = prevMatch.status;

		// Check if path is an external URL.
		if (isUrl(path)) headers.normal.set('location', path);

		// Redirect user to external URL for redirects.
		if (headers.normal.has('location')) {
			if (!status || status < 300 || status >= 400) {
				status = 307;
			}

			return new Response(null, { status, headers: headers.normal });
		}

		if (!skipErrorMatch && status && status >= 400) {
			// Fetch match for error route.
			const errorMatch = await matcher(
				'error',
				req,
				new URL(req.url),
				parse(req.headers.get('cookie') || ''),
				prevMatch,
				status // Search for a route with the same status code.
			);

			return serve(req, errorMatch, true);
		}

		let resp = await runItem(
			output[path],
			req,
			{ path, status, headers, searchParams },
			assets,
			ctx
		);

		const newHeaders = headers.normal;
		applyHeaders(resp.headers, newHeaders);
		applyHeaders(headers.important, newHeaders);

		resp = new Response(resp.body, {
			...resp,
			status: status || resp.status,
			headers: newHeaders,
		});

		return resp;
	}

	return {
		/**
		 * Match a request to a route from the Vercel build output.
		 *
		 * @param req Request object.
		 * @returns The matched set of path, status, headers, and search params.
		 */
		match: (req: Request) =>
			matcher(
				'none',
				req,
				new URL(req.url),
				parse(req.headers.get('cookie') || '')
			),
		/**
		 * Serves a file from the Vercel build output.
		 *
		 * @param req Request object.
		 * @param prevMatch The match from the Vercel build output.
		 * @returns A response object.
		 */
		serve: (req: Request, match: MatchedSet) => serve(req, match, false),
	};
}
