declare const __NEXT_ON_PAGES__: { fetch: ExportedHandlerFetchHandler };

export default {
	async fetch(request, env, ctx) {
		return __NEXT_ON_PAGES__.fetch(request, env, ctx);
	},
} as ExportedHandler;
