# Supported Versions and Features

## Supported Next.js versions

Based on manual testing, it seems like the latest Next.js version (`13.4.2` at the time of writing) is supported.

Earlier and Later versions might be only partially supported, we don't fully know.

> The team is very soon going to test various different versions and make improvements to the documentation on which Next.js versions are supported and to what degree.

## Supported Features

### Node.js

Next.js offers two different [runtimes](https://nextjs.org/docs/app/building-your-application/rendering/edge-and-nodejs-runtimes#nodejs-runtime) for your application's routes: `Node.js` and `Edge`.

Routes using the `Node.js` runtime get built as Node.js serverless functions, such are fundamentally incompatible with the Cloudflare network and so only routes using the `Edge` runtime are supported when using `@cloudflare/next-on-pages`.

The [Cloudflare workers runtime supports certain Node.js APIs](https://developers.cloudflare.com/workers/platform/nodejs-compatibility/), but currently Next.js in its `Edge` runtime only supports a [subset](https://github.com/vercel/next.js/blob/06f505c78bcc25ad4756f0e1665d239c0f45a3e2/packages/next/src/build/webpack/plugins/middleware-plugin.ts#L788-L794) of them, resulting in only the following Node.js built-in modules being currently supported in `@cloudflare/next-on-pages`:

- `buffer`
- `events`
- `assert`
- `util`
- `async_hooks`

### External Packages

You can use any external npm package in your Next.js application, but keep in mind that many packages do rely on Node.js APIs, which, as presented in the previous section could not be supported.

If you're application is using a package which relies on unsupported Node.js APIs there is often little to be done, generally the only feasible solutions are to either look for an alternative edge-compatible package or see if the current package could be updated in an edge-compatible manner.

### Build Output Configuration

> The following options have been gathered from the [Vercel Build Output API (v3) documentation](https://vercel.com/docs/build-output-api/v3#build-output-configuration):

| `config.json` property  | Support |
| ----------------------- | ------- |
| version                 | `3`     |
| routes `src`            | ✅      |
| routes `dest`           | ✅      |
| routes `headers`        | ✅      |
| routes `methods`        | ✅      |
| routes `continue`       | ✅      |
| routes `caseSensitive`  | ✅      |
| routes `check`          | ✅      |
| routes `status`         | ✅      |
| routes `has`            | ✅      |
| routes `missing`        | ✅      |
| routes `locale`         | ✅      |
| routes `middlewarePath` | ✅      |
| images<sup>1</sup>      | 🔄      |
| wildcard                | 🔄      |
| overrides               | ✅      |
| cache                   | ❌      |
| crons                   | ❌      |

    - ✅: Supported
    - 🔄: Not currently supported, but it's probably possible and we may add support in the future
    - ❌: Not supported and unlikely we ever will support this

- _1_ - **images**: If you want to use `next/image`, you can provide your own [custom loader](https://nextjs.org/docs/api-reference/next/image#loader) and use Cloudflare Image Resizing, as per [Cloudflare's Image Resizing documentation](https://developers.cloudflare.com/images/image-resizing/integration-with-frameworks/#nextjs).

### next.config.js Properties

> The following options have been gathered from the Next.js [next.config.js documentation](https://nextjs.org/docs/app/api-reference/next-config-js), alongside the [Internationalized routing documentation](https://nextjs.org/docs/advanced-features/i18n-routing).

<!-- TODO: update this table to reflect the latest version on the next.js docs, and test the various options to determine which are supported -->

| Option                                     | Support |
| ------------------------------------------ | ------- |
| environment variables                      | ✅      |
| base path                                  | ✅      |
| rewrites                                   | ✅      |
| redirects                                  | ✅      |
| custom headers                             | ✅      |
| custom page extensions                     | ✅      |
| CDN support with asset prefix              | 🔄      |
| custom Image loader config                 | 🔄      |
| custom webpack config                      | ✅      |
| compression<sup>1</sup>                    | ❌      |
| runtime configuration<sup>2</sup>          | ❌      |
| disabling x-powered-by                     | 🔄      |
| disabling ETag generation                  | 🔄      |
| disabling HTTP keep-alive                  | ❌      |
| setting custom build directory<sup>3</sup> | ❌      |
| configuring the build id                   | ✅      |
| configuring onDemandEntries<sup>4</sup>    | ❌      |
| ignoring ESLint                            | ✅      |
| ignoring TypeScript errors                 | ✅      |
| exportPathMap<sup>5</sup>                  | ❌      |
| trailing slash                             | 🔄      |
| react Strict Mode<sup>6</sup>              | 🔄      |
| URL imports                                | ✅      |
| build indicator<sup>7</sup>                | ❌      |
| Turbopack-specific options<sup>8</sup>     | ❌      |
| internationalized (i18n) routing           | ✅      |

    - ✅: Supported
    - 🔄: Not currently supported, but it's probably possible and we may add support in the future
    - ❌: Not supported and unlikely we ever will support this

- _1_ - **compression**: [Cloudflare applies gzip or brotli compression](https://developers.cloudflare.com/support/speed/optimization-file-size/what-will-cloudflare-compress) automatically. When developing locally with Wrangler, no compression is applied.

- _2_ - **runtime configuration**: We could look into implementing the runtime configuration but it is probably not worth it since it is a legacy configuration and environment variables should be used instead.

- _3_ - **setting custom build directory**: Applications built using `@cloudflare/next-on-pages` don't rely on the `.next` directory so this option isn't really applicable.

- _4_ - **configuring onDemandEntries**: Not applicable since it's an option for the Next.js server during development which we don't rely on.

- _5_ - **exportPathMap**: Option used for SSG not applicable for apps built using `@cloudflare/next-on-pages`.

- _6_ - **React strict mode**: Currently we build the application so React strict mode doesn't work either way. If we can make strict mode work, this option will most likely work straight away.

- _7_ - **build indicator**: If you're developing using `wrangler pages dev`, we do hard refreshes so the indicator doesn't appear. If you run your app locally using `next dev`, this option works fine.

- _8_ - **Turbopack-specific options**: Turbopack is not currently supported on `@cloudflare/next-on-pages` (this might change in the future so we might reconsider the addition of this option).

### Rendering and Data Fetching

#### Incremental Static Regeneration

Incremental Static Regeneration (ISR) is a rendering mode in Next.js that allows you to automatically cache and periodically regenerate pages with fresh data. Next.js [does not support](https://nextjs.org/docs/pages/building-your-application/rendering/incremental-static-regeneration) building ISR pages for the edge runtime, and as such, pages should be changed to use server side rendering (SSR) instead.

ISR pages are built by the Vercel CLI to generate Vercel [Prerender Functions](https://vercel.com/docs/build-output-api/v3/primitives#prerender-functions). These are Node.js serverless functions that can be called in the background while serving the page from the cache. It is not possible to use these with Cloudflare Pages and they are not compatible with the [edge runtime](https://nextjs.org/docs/app/api-reference/edge) currently.

In case the Vercel build process generates predendered pages for your application, `@cloudflare/next-on-pages` will use static fallback files that are generated by the build process so that your application will still correctly serve your ISR/prerendered pages (but without the regeneration aspect).

#### Statically Generated Routes Edge Cases

Next.js performs a form of static analysis on routes to determine whether they can be [statically generated](https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic-rendering), or if they need to be dynamically rendered at request time. In most cases, `@cloudflare/next-on-pages` can handle these pages fine. However, there are some edge cases where this is not possible with pages that have dynamic parameters.

##### `generateStaticParams`

When doing static site generation (SSG) in the app directory, you need to indicate in each page that it is not possible for non-prerendered dynamic routes to occur, i.e. [they should return a 404 response](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#dynamicparams). This is so that the Vercel build process doesn't generate a Node.js serverless function for the dynamic parameter, while generating prerendered HTML files for all params provided by `generateStaticParams` instead.

```diff
+ export const dynamicParams = false;
```

##### `getStaticPaths`

In the pages directory, when doing static site generation (SSG), there is a similar scenario as the app dir `generateStaticParams` one. Because of how ISR functions work, you need to indicate that the page [should return a 404 response](https://nextjs.org/docs/pages/api-reference/functions/get-static-paths#fallback-false) for non-prerendered dynamic routes. This is done by setting `fallback: false` in `getStaticPaths`.

```diff
export async function getStaticPaths() {
	const res = await fetch('https://.../posts');
	const posts = await res.json();

	// Get the paths we want to pre-render based on posts
	const paths = posts.map(post => ({ params: { id: post.id } }));

	// We'll pre-render only these paths at build time.
	// { fallback: false } means other routes should 404.
	return {
		paths,
+		fallback: false.
	};
}
```

#### Revalidating Data and `next/cache`

Revalidation and `next/cache` are not supported on Cloudflare Pages. This is used by the default `fetch` cache, which forms part of the incremental cache for revalidating data inside the App Router. Revalidating tags and data for an entire path also uses `next/cache`.

The Next.js cache does however work when self-hosting by optionally providing a [custom cache handler](https://nextjs.org/docs/app/api-reference/next-config-js/incrementalCacheHandlerPath). It's possible this could use Cloudflare KV or Durable Objects in the future.

##### Fetch Cache

Cloudflare Pages' runtime does not support the `cache` property on the [patched fetch](https://github.com/vercel/next.js/blob/canary/packages/next/src/server/lib/patch-fetch.ts) used in Next.js. For example, the following piece of code would throw an error when run on Cloudflare Pages. This is due to the fact that the `cache` property is not supported by the [Fetch API](https://developers.cloudflare.com/workers/runtime-apis/request/#requestinit) implemented in the Workers runtime.

```typescript
fetch('https://...', { cache: 'no-store' });
```
