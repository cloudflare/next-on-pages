import { SUSPENSE_CACHE_URL } from '../cache';
import { handleRequest } from './handleRequest';
import {
	adjustRequestForVercel,
	handleImageResizingRequest,
	patchFetch,
} from './utils';
import type { AsyncLocalStorage } from 'node:async_hooks';

declare const __NODE_ENV__: string;

declare const __CONFIG__: ProcessedVercelConfig;

declare const __BUILD_OUTPUT__: VercelBuildOutput;

declare const __BUILD_METADATA__: NextOnPagesBuildMetadata;

declare const __ENV_ALS_PROMISE__: Promise<null | AsyncLocalStorage<unknown>>;

export default {
	async fetch(request, env, ctx) {
		patchFetch();

		const envAsyncLocalStorage = await __ENV_ALS_PROMISE__;
		if (!envAsyncLocalStorage) {
			const reqUrl = new URL(request.url);
			const noNodeJsCompatStaticPageRequest = await env.ASSETS.fetch(
				`${reqUrl.protocol}//${reqUrl.host}/cdn-cgi/errors/no-nodejs_compat.html`,
			);
			const responseBody = noNodeJsCompatStaticPageRequest.ok
				? noNodeJsCompatStaticPageRequest.body
				: "Error: Could not access built-in Node.js modules. Please make sure that your Cloudflare Pages project has the 'nodejs_compat' compatibility flag set.";
			return new Response(responseBody, { status: 503 });
		}

		return envAsyncLocalStorage.run(
			// NOTE: The `SUSPENSE_CACHE_URL` is used to tell the Next.js Fetch Cache where to send requests.
			{ ...env, NODE_ENV: __NODE_ENV__, SUSPENSE_CACHE_URL },
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

				return handleRequest(
					{
						request: adjustedRequest,
						ctx,
						assetsFetcher: env.ASSETS,
					},
					__CONFIG__,
					__BUILD_OUTPUT__,
					__BUILD_METADATA__,
				);
			},
		);
	},
} as ExportedHandler<{ ASSETS: Fetcher }>;
