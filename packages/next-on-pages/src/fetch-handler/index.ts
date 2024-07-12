export default {
	async fetch() {
		return new Response();
	},
} as { fetch: ExportedHandlerFetchHandler<{ ASSETS: Fetcher }> };
