import { handleRequest } from './handleRequest';
import { adjustRequestForVercel } from './utils';
import type { AsyncLocalStorage } from 'node:async_hooks';

declare const __NODE_ENV__: string;

declare const __CONFIG__: ProcessedVercelConfig;

declare const __BUILD_OUTPUT__: VercelBuildOutput;

declare const __ENV_ALS__: AsyncLocalStorage<unknown> & {
	NODE_ENV: string;
};

export default {
	async fetch(request, env, ctx) {
		const cloudflare = {
			cf: request.cf,
			env,
			ctx,
		};
		return __ENV_ALS__.run({ cloudflare, NODE_ENV: __NODE_ENV__ }, () => {
			const adjustedRequest = adjustRequestForVercel(request);

			return handleRequest(
				{
					request: adjustedRequest,
					ctx,
					assetsFetcher: env.ASSETS,
				},
				__CONFIG__,
				__BUILD_OUTPUT__
			);
		});
	},
} as ExportedHandler<{ ASSETS: Fetcher }>;
