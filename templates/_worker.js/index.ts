import { adjustRequestForVercel } from './utils';
import { Router } from './router';

declare const __CONFIG__: ProcessedVercelConfig;

declare const __BUILD_OUTPUT__: VercelBuildOutput;

export default {
	async fetch(request, env, ctx) {
		globalThis.process.env = { ...globalThis.process.env, ...env };

		const requestRouter = new Router(
			__CONFIG__,
			__BUILD_OUTPUT__,
			env.ASSETS,
			ctx
		);

		const adjustedRequest = adjustRequestForVercel(request);

		return requestRouter.handle(adjustedRequest);
	},
} as ExportedHandler<{ ASSETS: Fetcher }>;
