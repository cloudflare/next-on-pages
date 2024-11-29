import type { Assets } from 'build-output-router';
import {
	applyHeaders,
	createRouteRequest,
	createMutableResponse,
	applySearchParams,
} from 'build-output-router/router';
import type { RequestContext } from '../../../src/utils/requestContext';

/**
 * Gets an asset handler that runs or fetches a build output item.
 *
 * @param output Build output.
 * @param requestCtx Request context.
 * @returns Response object.
 */
export function getAssetsHandler(
	output: VercelBuildOutput,
	{ request, assetsFetcher, ctx }: RequestContext,
): Assets {
	return {
		has: p => p in output,
		get: p => {
			const item = output[p];
			if (!item) return null;

			return {
				isStaticAsset: item.type === 'static' || item.type === 'override',
				isRouteFunction: item.type === 'function',
				isMiddleware: item.type === 'middleware',
				fetch: async ({ path, searchParams }) => {
					let resp: Response | undefined = undefined;

					// Apply the search params from matching the route to the request URL.
					const url = new URL(request.url);
					applySearchParams(url.searchParams, searchParams);
					const req = new Request(url, request);

					try {
						switch (item?.type) {
							case 'function':
							case 'middleware': {
								const edgeFunction: EdgeFunction = await import(
									item.entrypoint
								);
								try {
									resp = await edgeFunction.default(req, ctx);
								} catch (e) {
									const err = e as Error;
									if (
										err.name === 'TypeError' &&
										err.message.endsWith('default is not a function')
									) {
										throw new Error(
											`An error occurred while evaluating the target edge function (${item.entrypoint})`,
										);
									}
									throw e;
								}
								break;
							}
							case 'static': {
								resp = await assetsFetcher.fetch(
									createRouteRequest(req, item.path ?? path),
								);

								if (item.headers) {
									resp = createMutableResponse(resp);
									applyHeaders(resp.headers, item.headers);
								}
								break;
							}
							default: {
								resp = new Response('Not Found', { status: 404 });
							}
						}
					} catch (e) {
						// eslint-disable-next-line no-console
						console.error(e);
						return new Response('Internal Server Error', {
							status: 500,
						});
					}

					return createMutableResponse(resp);
				},
			};
		},
	};
}
