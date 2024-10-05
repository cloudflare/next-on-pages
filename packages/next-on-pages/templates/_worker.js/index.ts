import { SUSPENSE_CACHE_URL } from '../cache';
import { setupRoutesIsolation } from './routesIsolation';
import {
	adjustRequestForVercel,
	getAssetsHandler,
	handleImageResizingRequest,
	patchFetch,
} from './utils';
import type { AsyncLocalStorage } from 'node:async_hooks';
import { Router } from 'build-output-router';

declare const __NODE_ENV__: string;

declare const __CONFIG__: ProcessedVercelConfig;

declare const __BUILD_OUTPUT__: VercelBuildOutput;

declare const __BUILD_METADATA__: NextOnPagesBuildMetadata;

declare const __ALSes_PROMISE__: Promise<null | {
	envAsyncLocalStorage: AsyncLocalStorage<unknown>;
	requestContextAsyncLocalStorage: AsyncLocalStorage<unknown>;
}>;

const router = new Router(__CONFIG__.routes, {
	locales: new Set(__BUILD_METADATA__.collectedLocales),
	wildcardConfig: __CONFIG__.wildcard,
});

export default {
	async fetch(request, env, ctx) {
		setupRoutesIsolation();
		patchFetch();

		const asyncLocalStorages = await __ALSes_PROMISE__;

		if (!asyncLocalStorages) {
			const reqUrl = new URL(request.url);
			const noNodeJsCompatStaticPageRequest = await env.ASSETS.fetch(
				`${reqUrl.protocol}//${reqUrl.host}/cdn-cgi/errors/no-nodejs_compat.html`,
			);
			const responseBody = noNodeJsCompatStaticPageRequest.ok
				? noNodeJsCompatStaticPageRequest.body
				: "Error: Could not access built-in Node.js modules. Please make sure that your Cloudflare Pages project has the 'nodejs_compat' compatibility flag set.";
			return new Response(responseBody, { status: 503 });
		}

		const { envAsyncLocalStorage, requestContextAsyncLocalStorage } =
			asyncLocalStorages;

		return envAsyncLocalStorage.run(
			// NOTE: The `SUSPENSE_CACHE_URL` is used to tell the Next.js Fetch Cache where to send requests.
			{ ...env, NODE_ENV: __NODE_ENV__, SUSPENSE_CACHE_URL },
			async () => {
				return requestContextAsyncLocalStorage.run(
					{ env, ctx, cf: request.cf },
					async () => {
						const url = new URL(request.url);
						if (url.pathname.startsWith('/_next/image')) {
							return handleImageResizingRequest(request, {
								buildOutput: __BUILD_OUTPUT__,
								assetsFetcher: env.ASSETS,
								imagesConfig: __CONFIG__.images,
							});
						}

						const adjustedRequest = adjustRequestForVercel(request);

						const assets = getAssetsHandler(__BUILD_OUTPUT__, {
							request: adjustedRequest,
							ctx,
							assetsFetcher: env.ASSETS,
						});

						return router.fetch({ request: adjustedRequest, ctx, assets });
					},
				);
			},
		);
	},
} as ExportedHandler<{ ASSETS: Fetcher }>;
