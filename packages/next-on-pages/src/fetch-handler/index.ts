import 'server-only';

export default {
	async fetch() {
		throw new Error(
			'Invalid invocation of the next-on-pages fetch handler - this method should only be used alongside the --custom-entrypoint CLI option. For more details, see: https://github.com/cloudflare/next-on-pages/blob/main/packages/next-on-pages/docs/advanced-usage.md#custom-entrypoint',
		);
	},
} as { fetch: ExportedHandlerFetchHandler<{ ASSETS: Fetcher }> };
