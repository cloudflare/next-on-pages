import nextOnPagesHandler from '@cloudflare/next-on-pages/fetch-handler';

export default {
	async fetch(...args) {
		const response = await nextOnPagesHandler.fetch(...args);

		response.headers.set('custom-entrypoint', '1');

		return response;
	},
} as ExportedHandler<{ ASSETS: Fetcher }>;
