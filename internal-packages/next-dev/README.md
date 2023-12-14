# Next-on-pages Next-Dev

> **Warning**
> The submodule API needs to be finalized, in the meantime the submodule is being exported as `__experimental__next-dev`, the `__experimental__` prefix will be removed in a future release

The `next-dev` submodule of the `@cloudflare/next-on-pages` package implements a utility that allows you to run the [standard Next.js development server](https://nextjs.org/docs/app/api-reference/next-cli#development) (with hot-code reloading, error reporting, HMR and everything it has to offer) with also adding local Cloudflare bindings simulations (implemented via [Miniflare](https://github.com/cloudflare/miniflare)).

IMPORTANT: As mentioned above the module allows you to run the standard Next.js dev server as is and it only makes sure that Cloudflare bindings are accessible, it does not generate a worker nor faithfully represent the final application that will be deployed to Cloudflare Pages, so please use this only as a development tool and make sure to properly test your application with `wrangler pages dev` before actually deploying it to.

## How to use the module

The module is part of the `@cloudflare/next-on-pages` package so it does not need installation, it exports the `setupDevBindings` function which you need to import and call in your `next.config.js` file to declare what bindings your application is using and need to be made available in the development server.

After having added the `setupDevBindings` call to the `next.config.js` you can simply run `next dev` and inside your edge routes you will be able to access your bindings via `process.env` in the exact same way as you would in your production code.

### Example

Let's see an example of how to use the utility, in a Next.js application built in TypeScript using the App router.

Firstly we need to update the `next.config.js` file:

```js
// file: next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = nextConfig;

// we only need to use the utility during development so we can check NODE_ENV
// (note: this check is recommended but completely optional)
if (process.env.NODE_ENV === 'development') {
	// we import the utility from the next-dev submodule
	const { setupDevBindings } = require('@cloudflare/next-on-pages/next-dev');

	// we call the utility with the bindings we want to have access to
	setupDevBindings({
		kvNamespaces: ['MY_KV_1', 'MY_KV_2'],
		r2Buckets: ['MY_R2'],
		durableObjects: {
			MY_DO: {
				scriptName: 'do-worker',
				className: 'DurableObjectClass',
			},
		},
		// ...
	});
}
```

Next (optional but highly recommended) we create a [TypeScript declaration file](https://www.typescriptlang.org/docs/handbook/2/type-declarations.html) so that we can make sure that TypeScript is aware of the bindings added to `process.env`:

```ts
// file: env.d.ts

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			[key: string]: string | undefined;
			MY_KV_1: KVNamespace;
			MY_KV_2: KVNamespace;
			MY_R2: R2Bucket;
			MY_DO: DurableObjectNamespace;
		}
	}
}

export {};
```

> **Note**
> The binding types used in the above file come from `@cloudflare/workers-types`, in order to use them make sure that you've installed the package as a dev dependency and you've added it to your `tsconfig.js` file under `compilerOptions.types`.

Then we can simply use any of our bindings inside our next application, for example in the following API route:

```ts
export const runtime = 'edge';

export async function GET(request: NextRequest) {
	const myKv = process.env.MY_KV;

	const valueA = await myKv.get('key-a');

	return new Response(`The value of key-a in MY_KV is: ${valueA}`);
}
```

## Recommended Workflow

When developing a next-on-pages application, this is the development workflow that we recommend:

- **Develop using the standard Next.js dev server**\
  In order to have a very fast and polished dev experience the standard dev server provided by Next.js is the best available option. So use it to quickly make changes and iterate over them, while still having access to your Cloudflare bindings thanks to the
  `next-dev` submodule.
- **Build and preview your worker locally**\
  In order to make sure that your application is being built in a manner that is fully compatible with Cloudflare Pages, before deploying it, or whenever you're comfortable checking the correctness of the application during your development process, build your worker by using `@cloudflare/next-on-pages` and preview it locally via `wrangler pages dev .vercel/output/static`, this is the only way to locally make sure that every is working as you expect it to.
- **Deploy your app and iterate**\
  Once you've previewed your application locally then you can deploy it to Cloudflare Pages (both via direct uploads or git integration) and iterate over the process to make new changes.
