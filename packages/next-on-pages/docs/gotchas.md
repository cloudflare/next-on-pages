# Gotchas

## App router

### Not found

Next.js generates a not-found route for your application under the hood during the build process. In some circumstances Next.js can detect that the route requires server side logic (particularly if computation is being performed in the root layout component) and it might create a node.js serverless function (which, as such, is incompatible with `@cloudflare/next-on-pages`).

To prevent such problem we recommend to always provide a custom not found route which explicitly opts-in the edge runtime:

```ts
// file: (src/)app/not-found.(jsx|tsx)
export const runtime = 'edge';

export default async function NotFound() {
    // ...
    return (
        // ...
    );
}
```

### `generateStaticParams`

When doing static site generation (SSG) in the app directory and using the [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) utility, Next.js by default tries to handle requests for non statically generated routes on-demand. It does so by creating a Next.js serverless function (which, as such, is incompatible with `@cloudflare/next-on-pages`).

In such cases you need to instruct Next.js not to do so by specifying a `false` [`dynamicParams`](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#dynamicparams):

```diff
+ export const dynamicParams = false;
```

## Pages router

### `getStaticPaths`

When doing static site generation (SSG) in the pages directory and using the [`getStaticPaths`](https://nextjs.org/docs/pages/api-reference/functions/get-static-paths) utility, Next.js by default tries to handle requests for non statically generated routes on-demand. It does so by creating a node.js serverless function (which, as such, is incompatible with `@cloudflare/next-on-pages`).

In such cases you need to instruct Next.js not to do so by specifying a [false `fallback`](https://nextjs.org/docs/pages/api-reference/functions/get-static-paths#fallback-false):

```diff
export async function getStaticPaths() {
    // ...

    return {
        paths,
+       fallback: false,
	};
}
```

> Note that the `paths` array cannot be empty as that causes Next.js to ignore the provided `fallback` value, so make sure that at build time at least one entry is present in the array
