import { adjustRequestForVercel } from './utils';
import { router } from './router';

declare const __CONFIG__: ProcessedVercelConfig;

declare const __BUILD_OUTPUT__: VercelBuildOutput;

export default {
	async fetch(request, env, ctx) {
		globalThis.process.env = { ...globalThis.process.env, ...env };

		const adjustedRequest = adjustRequestForVercel(request);

		const requestRouter = router(__CONFIG__, __BUILD_OUTPUT__, env.ASSETS, ctx);
		const matched = await requestRouter.match(adjustedRequest);

		return requestRouter.serve(adjustedRequest, matched);
	},
} as ExportedHandler<{ ASSETS: Fetcher }>;
