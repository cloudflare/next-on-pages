import { handleRequest } from './handleRequest';
import { adjustRequestForVercel } from './utils';

declare const __CONFIG__: ProcessedVercelConfig;

declare const __BUILD_OUTPUT__: VercelBuildOutput;

export default {
	async fetch(request, env, ctx) {
		globalThis.process.env = { ...globalThis.process.env, ...env };

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
	},
} as ExportedHandler<{ ASSETS: Fetcher }>;
