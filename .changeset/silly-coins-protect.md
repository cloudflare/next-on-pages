---
'@cloudflare/next-on-pages': minor
---

Add support for custom worker entrypoints.

Example:
```ts
import nextOnPagesHandler from '@cloudflare/next-on-pages/fetch-handler';

export default {
	async fetch(request, env, ctx) {
		// do something before running the next-on-pages handler

		const response = await nextOnPagesHandler.fetch(request, env, ctx);

		// do something after running the next-on-pages handler

		return response;
	},
} as ExportedHandler<{ ASSETS: Fetcher }>;
