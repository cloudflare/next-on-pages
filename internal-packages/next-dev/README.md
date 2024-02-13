# Next-on-pages Next-Dev

The `next-dev` submodule of the `@cloudflare/next-on-pages` package implements a utility that allows you to run the [standard Next.js development server](https://nextjs.org/docs/app/api-reference/next-cli#development) (with hot-code reloading, error reporting, HMR and everything it has to offer) with also local Cloudflare integration.

**IMPORTANT**: As mentioned above the module allows you to run the standard Next.js dev server as is and it only makes sure that a simulation of the Cloudflare specific data (retrievable using `getRequestContext`) is available. It does not generate a worker nor faithfully represent the final application that will be deployed to Cloudflare Pages, so please use this only as a development tool and make sure to properly test your application with `wrangler pages dev` before actually deploying it to Cloudflare.

## How to use the module

The module is part of the `@cloudflare/next-on-pages` package so it does not need installation, it exports the `setupDevPlatform` function which you need to import and call in your Next.js config file (`next.config.mjs` or `next.config.(c)js`). The utility will read your [`wrangler.toml`](https://developers.cloudflare.com/workers/wrangler/configuration/) gather information from it and use it to simulate the Cloudflare platform in the in the dev server.

After having created an appropriate `wrangler.toml` file and added the `setupDevPlatform` call to the Next.js config file you can simply run `next dev` and inside your edge routes you will be able to access your bindings via `getRequestContext` in the exact same way as you would in your production code.

`setupDevPlatform` uses wrangler's `getBindingsProxy` utility under the hood, it accepts the same exact arguments and supports bindings in the same exact manner, for more details please refer to the official [`getBindingsProxy` documentation](https://developers.cloudflare.com/workers/wrangler/api/#getbindingsproxy).

### Example

Let's see an example of how to use the utility, in a Next.js application built in TypeScript using the App router.

Firstly let's define a simple `wrangler.toml` file which only declares bindings:

```toml
[[kv_namespaces]]
binding = "MY_KV_1"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

[[kv_namespaces]]
binding = "MY_KV_2"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

[[durable_objects.bindings]]
name = "MY_DO"
script_name = "do-worker"
class_name = "DurableObjectClass"

[[r2_buckets]]
binding = "MY_R2"
bucket_name = "my-bucket"
```

Then we need update the `next.config.mjs` file:

```js
// file: next.config.mjs

// we import the utility from the next-dev submodule
import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev';

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;

// we only need to use the utility during development so we can check NODE_ENV
// (note: this check is recommended but completely optional)
if (process.env.NODE_ENV === 'development') {
	// we simply need to call the utility
	setupDevPlatform();
}
```

Next (optional but highly recommended) we create a [TypeScript declaration file](https://www.typescriptlang.org/docs/handbook/2/type-declarations.html) that defines/extends a `CloudflareEnv` interface (the same interface used by `getRequestContext`):

```ts
// file: env.d.ts
declare global {
	interface CloudflareEnv {
		MY_KV_1: KVNamespace;
		MY_KV_2: KVNamespace;
		MY_R2: R2Bucket;
		MY_DO: DurableObjectNamespace;
	}
}
```

> **Note**
> The binding types used in the above file come from `@cloudflare/workers-types`, in order to use them make sure that you've installed the package as a dev dependency and you've added it to your `tsconfig.js` file under `compilerOptions.types`.

Then we can simply use the platform and any of its bindings inside our Next.js application, for example in the following API route:

```ts
export const runtime = 'edge';

export async function GET(request: NextRequest) {
	const { env } = getRequestContext();
	const myKv = env.MY_KV_1;

	const valueA = await myKv.get('key-a');

	return new Response(`The value of key-a in MY_KV is: ${valueA}`);
}
```

## Recommended development workflow

When developing a `next-on-pages` application, this is the development workflow that we recommend:

### Develop using the standard Next.js dev server

Develop your application using the [standard development server provided by Next.js](https://nextjs.org/docs/getting-started/installation#run-the-development-server). It is the best available option for a fast and polished development experience and the `next-dev` submodule makes it possible to use it while also being able to access a faithful simulation of the Cloudflare platform.

### Build and preview your application locally

In order to make sure that your application is being built in a manner that is fully compatible with Cloudflare Pages, before deploying it, or whenever you're comfortable checking the correctness of the application during your development process you'll want to build and preview it locally using Cloudflare's `workerd` JavaScript runtime.

To do so build your worker by using `@cloudflare/next-on-pages` and preview it locally via `wrangler pages dev .vercel/output/static --compatibility-flag nodejs_compat`.

By doing this, you can run your application locally to make sure everything is working as you expect it to.

### Deploy your app and iterate

Once you've previewed your application locally then you can deploy it to Cloudflare Pages (both via [direct uploads](https://developers.cloudflare.com/pages/get-started/direct-upload/) or [git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)) and iterate over the process to make new changes.
