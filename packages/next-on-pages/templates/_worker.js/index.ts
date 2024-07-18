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

export default {
	async fetch(request, env, ctx) {
		setupRouteIsolationMap();
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

type RouteIsolation = {
	_map: Map<string, unknown>;
	getProxyFor: (route: string) => unknown;
}

function setupRouteIsolationMap() {
	const g = globalThis as {__nextOnPagesRouteIsolation?: RouteIsolation};
	g.__nextOnPagesRouteIsolation ??= {
		_map: new Map(),
		getProxyFor: (route: string) => {
			let proxy = g.__nextOnPagesRouteIsolation!._map.get(route);

			if(proxy) {
				return proxy;
			}

			const overrides = new Map<string|symbol, unknown>();

			proxy = new Proxy(
				globalThis,
				{
					get: (_, property) => {
						let result: unknown;
						if(overrides.has(property)) {
							result = overrides.get(property);
						} else {
							result = Reflect.get(globalThis, property);
						}
						console.log(`--- (${overrides.has(property)}) ======> get (${property.toString()}) = ${result}`);
						return result;
					},
					set: (_, property, value) => {
						if(typeof property === 'string' && property.startsWith('webpackChunk_')){
							Reflect.set(globalThis, property, value);
							return true;
						}
						console.log(`---======> set (${property.toString()}) to ${value}`);
						overrides.set(property, value);
						return true;
					},
				}
			);

			g.__nextOnPagesRouteIsolation!._map.set(route, proxy);

			return proxy;
		},
	};
}