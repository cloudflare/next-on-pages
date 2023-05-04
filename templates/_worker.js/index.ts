import { handleRequest } from './handleRequest';
import { adjustRequestForVercel } from './utils';
import type { AsyncLocalStorage } from 'node:async_hooks';

declare const __CONFIG__: ProcessedVercelConfig;

declare const __BUILD_OUTPUT__: VercelBuildOutput;

declare const __ENV_ALS__: AsyncLocalStorage<unknown> & {
	NODE_ENV: string;
};

export default {
	async fetch(request, env, ctx) {
		return __ENV_ALS__.run({ ...env, NODE_ENV: __ENV_ALS__.NODE_ENV }, () => {
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
