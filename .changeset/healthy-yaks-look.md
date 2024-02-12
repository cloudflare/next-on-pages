---
'@cloudflare/next-on-pages': minor
---

Add new `getRequestContext` utility

Introduce a new `getRequestContext` utility that allows developer to get access not only
to their Cloudflare `env` but also to their `cf` and `ctx` objects

The utility can only be used in server-only code (meaning that it is incompatible with
Pages-router components).

Usage example:

```ts
// app/api/hello/route.js

import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

export async function GET(request) {
	const {
		env,
		cf,
		ctx: { waitUntil },
	} = getRequestContext();
	// ...
}
```
