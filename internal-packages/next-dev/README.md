# `next-dev` (`setupDevPlatform`)

`setupDevPlatform` lets you access [bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/) in local development of your Next.js app.

### Example

[`next.config.mjs`](https://nextjs.org/docs/app/api-reference/next-config-js):

```js

import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev';

const nextConfig = {};

export default nextConfig;

if (process.env.NODE_ENV === 'development') {
	await setupDevPlatform();
}
```

[`wrangler.toml`](https://developers.cloudflare.com/pages/functions/wrangler-configuration/):

```toml
[[kv_namespaces]]
binding = "MY_KV_1"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

A route in your Next.js app:


```ts
export const runtime = 'edge';

export async function GET(request: NextRequest) {
	const { env } = getRequestContext();
	const myKv = env.MY_KV_1;

	const valueA = await myKv.get('key-a');

	return new Response(`The value of key-a in MY_KV is: ${valueA}`);
}
```