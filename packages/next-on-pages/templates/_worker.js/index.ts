import { SUSPENSE_CACHE_URL } from '../cache';
import { handleRequest } from './handleRequest';
import { setupRoutesIsolation } from './routesIsolation';
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

const originalDefineProperty = Object.defineProperty;

const patchedDefineProperty = (
	...args: Parameters<typeof Object.defineProperty<unknown>>
) => {
	const target = args[0];
	const key = args[1];
	// Next.js defined an __import_unsupported global property as non configurable
	// with next-on-pages this apps try to re-define this property multiple times,
	// so here we patch `defineProperty` to just ignore re-definition of such property
	const importUnsupportedKey = '__import_unsupported';
	if (key === importUnsupportedKey) {
		if (
			typeof target === 'object' &&
			target !== null &&
			importUnsupportedKey in target
		) {
			return;
		}
	}
	return originalDefineProperty(...args);
};

globalThis.Object.defineProperty =
	patchedDefineProperty as typeof globalThis.Object.defineProperty;

globalThis.AbortController = class PatchedAbortController extends (
	AbortController
) {
	constructor() {
		try {
			super();
		} catch (e) {
			if (
				e instanceof Error &&
				e.message.includes('Disallowed operation called within global scope')
			) {
				// Next.js attempted to create an AbortController in the global scope
				// let's return something that looks like an AbortController but with
				// noop functionalities
				return {
					signal: {
						aborted: false,
						reason: null,
						onabort: () => {
							/* empty */
						},
						throwIfAborted: () => {
							/* empty */
						},
					} as unknown as AbortSignal,
					abort() {
						/* empty */
					},
				};
			} else {
				throw e;
			}
		}
	}
};

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
		);
	},
} as ExportedHandler<{ ASSETS: Fetcher }>;
