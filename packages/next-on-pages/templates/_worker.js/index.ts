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

declare const __ENV_ALS_PROMISE__: Promise<null | AsyncLocalStorage<unknown>>;

patchFetch();

export default {
	async fetch(request, env, ctx) {
		const envAsyncLocalStorage = await __ENV_ALS_PROMISE__;
		if (!envAsyncLocalStorage) {
			return new Response(
				`Error: Could not access built-in Node.js modules. Please make sure that your Cloudflare Pages project has the 'nodejs_compat' compatibility flag set.`,
				{ status: 503 },
			);
		}
		return envAsyncLocalStorage.run(
			{ ...env, NODE_ENV: __NODE_ENV__ },
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
				);
			},
		);
	},
} as ExportedHandler<{ ASSETS: Fetcher }>;
