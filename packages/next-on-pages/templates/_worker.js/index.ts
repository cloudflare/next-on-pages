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

declare const __ALSes_PROMISE__: Promise<null | {
	envAsyncLocalStorage: AsyncLocalStorage<unknown>;
	requestContextAsyncLocalStorage: AsyncLocalStorage<unknown>;
}>;

import type { run } from '../in-memory-mutex';

type MutexRunFn = typeof run;

/** Timeout that indicates how long the worker should wait before re-checking to see if a locked in-memory mutex has been released */
const inMemoryMutexSleepTimeout = 25;

export default {
	async fetch(request, env, ctx) {
		const inMemoryMutexPath = './__next-on-pages-dist__/in-memory-mutex.js';
		const { run } = (await import(inMemoryMutexPath)) as { run: MutexRunFn };

		const workerId = crypto.randomUUID();
		let done = run(workerId);
		let canRun = !!done;
		while (!canRun) {
			done = await new Promise<ReturnType<MutexRunFn>>(resolve => {
				setTimeout(() => {
					resolve(run(workerId));
				}, inMemoryMutexSleepTimeout);
			});
			canRun = !!done;
		}

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

						let response: Response;
						try {
							response = await handleRequest(
								{
									request: adjustedRequest,
									ctx,
									assetsFetcher: env.ASSETS,
								},
								__CONFIG__,
								__BUILD_OUTPUT__,
								__BUILD_METADATA__,
							);
						} catch (e) {
							const errorMessage =
								e instanceof Error ? e.message : JSON.stringify(e);
							response = new Response(
								`An internal server error occurred when handling the request: ${errorMessage}`,
								{ status: 500 },
							);
						} finally {
							// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
							done!();
						}
						return response;
					},
				);
			},
		);
	},
} as ExportedHandler<{ ASSETS: Fetcher }>;
