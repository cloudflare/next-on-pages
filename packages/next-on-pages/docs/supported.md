# Supported Versions and Features

## Operating Systems

`@cloudflare/next-on-pages` can be run on Linux, Mac OS and Windows but its usage under the latter is discouraged as we've noticed that one of the CLI's dependencies, the [Vercel CLI](https://vercel.com/docs/cli) (used to build the Next.js application) seems not to work reliably on Windows. If you need to run `@cloudflare/next-on-pages` on Windows we advise you to run it under the [Windows Subsystem for Linux](https://learn.microsoft.com/en-us/windows/wsl/).

## Supported Next.js versions

`@cloudflare/next-on-pages` supports all minor and patch version of Next.js 13. We regularly run manual and automated tests to ensure such compatibility.

Next.js canary versions not actively being tested and we don't currently extend support to these versions.

### Node.js

Next.js offers two different [runtimes](https://nextjs.org/docs/app/building-your-application/rendering/edge-and-nodejs-runtimes#nodejs-runtime) for your application's routes: `Node.js` and `Edge`.

Routes using the `Node.js` runtime get built as Node.js serverless functions, such are fundamentally incompatible with the Cloudflare network and so only routes using the `Edge` runtime are supported when using `@cloudflare/next-on-pages`.

The [Cloudflare workers runtime supports certain Node.js APIs](https://developers.cloudflare.com/workers/platform/nodejs-compatibility/), but currently Next.js in its `Edge` runtime only supports a [subset](https://github.com/vercel/next.js/blob/06f505c78bcc25ad4756f0e1665d239c0f45a3e2/packages/next/src/build/webpack/plugins/middleware-plugin.ts#L788-L794) of them, resulting in only the following Node.js built-in modules being currently supported in `@cloudflare/next-on-pages`:

- `buffer`
- `events`
- `assert`
- `util`
- `async_hooks`

## External Packages

You are free to use any external npm package with your Next application as long as it doesn't:

- require unsupported Node.js APIs (see above),
- use [JavaScript APIs](https://developers.cloudflare.com/workers/runtime-apis/web-standards/#javascript-standards) disabled by Cloudflare due to security concerns,
- nor it relies on features not supported by `@cloudflare/next-on-pages` (see below)

## Supported Features

### Routers

Both the [Pages](https://nextjs.org/docs/pages) and [App](https://nextjs.org/docs/app) routers are supported, however we recommend using the App router as there are a few unsupported features in the Pages one (including [custom error pages](https://github.com/cloudflare/next-on-pages/issues/174)), and since the latter is not the recommended one by the Next.js team, there is a good chance that it won't be improved/worked on to such a degree to allows us to increase our support of it.

The App router should be fully supported, but unfortunately a few of its features aren't currently supported (because of Vercel implementation details that are outside of our control) like for example [custom not-found pages with server side runtime logic](https://github.com/cloudflare/next-on-pages/issues/413).

To check the latest state of the routers and possible missing features you can check our GitHub [app router](https://github.com/cloudflare/next-on-pages/issues?q=is%3Aopen+is%3Aissue+label%3A%22app+router%22) and [pages router](https://github.com/cloudflare/next-on-pages/issues?q=is%3Aopen+is%3Aissue+label%3A%22pages+router%22) issues.

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
| images<sup>1</sup>      | ✅      |
| wildcard                | ✅      |
| overrides               | ✅      |
| cache                   | ❌      |
| crons                   | ❌      |

    - ✅: Supported
    - 🔄: Not currently supported, but it's probably possible and we may add support in the future
    - ❌: Not supported and unlikely to be supported in the future

- _1_ - **images**: If you want to use `next/image`, there are two options; allow the library to take care of incoming requests, or using a custom loader. Requests are intercepted in the router and image resizing is attempted to be used (due to limitations with Pages, it is not currently possible to use image resizing) - if image resizing is not available, it falls back to fetching the normal image URL. Alternatively, you can provide your own [custom loader](https://nextjs.org/docs/api-reference/next/image#loader) and use Cloudflare Image Resizing, as per [Cloudflare's Image Resizing documentation](https://developers.cloudflare.com/images/image-resizing/integration-with-frameworks/#nextjs).

### next.config.js Properties

> The following options have been gathered from the Next.js' next.config.js [app](https://nextjs.org/docs/app/api-reference/next-config-js) and [pages](https://nextjs.org/docs/pages/api-reference/next-config-js) documentations.

| Option                           | Next Docs                                                                                                                                                                                    | Support            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| appDir                           | [app](https://nextjs.org/docs/app/api-reference/next-config-js/appDir)                                                                                                                       | ✅                 |
| assetPrefix                      | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/assetPrefix), [app](https://nextjs.org/docs/app/api-reference/next-config-js/assetPrefix)                                 | 🔄                 |
| basePath                         | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/basePath), [app](https://nextjs.org/docs/app/api-reference/next-config-js/basePath)                                       | ✅                 |
| compress                         | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/compress), [app](https://nextjs.org/docs/app/api-reference/next-config-js/compress)                                       | `N/A`<sup>1</sup>  |
| devIndicators                    | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/devIndicators), [app](https://nextjs.org/docs/app/api-reference/next-config-js/devIndicators)                             | ❌<sup>2</sup>     |
| distDir                          | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/distDir), [app](https://nextjs.org/docs/app/api-reference/next-config-js/distDir)                                         | `N/A`<sup>3</sup>  |
| env                              | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/env), [app](https://nextjs.org/docs/app/api-reference/next-config-js/env)                                                 | ✅                 |
| eslint                           | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/eslint), [app](https://nextjs.org/docs/app/api-reference/next-config-js/eslint)                                           | ✅                 |
| exportPathMap                    | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/exportPathMap), [app](https://nextjs.org/docs/app/api-reference/next-config-js/exportPathMap)                             | `N/A`<sup>4</sup>  |
| generateBuildId                  | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/generateBuildId), [app](https://nextjs.org/docs/app/api-reference/next-config-js/generateBuildId)                         | ✅                 |
| generateEtags                    | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/generateEtags), [app](https://nextjs.org/docs/app/api-reference/next-config-js/generateEtags)                             | 🔄                 |
| headers                          | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/headers), [app](https://nextjs.org/docs/app/api-reference/next-config-js/headers)                                         | ✅                 |
| httpAgentOptions                 | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/httpAgentOptions), [app](https://nextjs.org/docs/app/api-reference/next-config-js/httpAgentOptions)                       | `N/A`              |
| images                           | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/images), [app](https://nextjs.org/docs/app/api-reference/next-config-js/images)                                           | ✅                 |
| incrementalCacheHandlerPath      | [app](https://nextjs.org/docs/app/api-reference/next-config-js/incrementalCacheHandlerPath)                                                                                                  | 🔄<sup>5</sup>     |
| mdxRs                            | [app](https://nextjs.org/docs/app/api-reference/next-config-js/mdxRs)                                                                                                                        | ✅                 |
| onDemandEntries                  | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/onDemandEntries), [app](https://nextjs.org/docs/app/api-reference/next-config-js/onDemandEntries)                         | `N/A`<sup>6</sup>  |
| output                           | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/output), [app](https://nextjs.org/docs/app/api-reference/next-config-js/output)                                           | `N/A`<sup>7</sup>  |
| pageExtensions                   | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/pageExtensions), [app](https://nextjs.org/docs/app/api-reference/next-config-js/pageExtensions)                           | ✅                 |
| poweredByHeader                  | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/poweredByHeader), [app](https://nextjs.org/docs/app/api-reference/next-config-js/poweredByHeader)                         | 🔄                 |
| productionBrowserSourceMaps      | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/productionBrowserSourceMaps), [app](https://nextjs.org/docs/app/api-reference/next-config-js/productionBrowserSourceMaps) | 🔄<sup>8</sup>     |
| reactStrictMode                  | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/reactStrictMode), [app](https://nextjs.org/docs/app/api-reference/next-config-js/reactStrictMode)                         | ❌<sup>9</sup>     |
| redirects                        | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/redirects), [app](https://nextjs.org/docs/app/api-reference/next-config-js/redirects)                                     | ✅                 |
| rewrites                         | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/rewrites), [app](https://nextjs.org/docs/app/api-reference/next-config-js/rewrites)                                       | ✅                 |
| Runtime Config                   | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/runtime-configuration), [app](https://nextjs.org/docs/app/api-reference/next-config-js/runtime-configuration)             | ❌<sup>10</sup>    |
| serverComponentsExternalPackages | [app](https://nextjs.org/docs/app/api-reference/next-config-js/serverComponentsExternalPackages)                                                                                             | `N/A`<sup>11</sup> |
| trailingSlash                    | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/trailingSlash), [app](https://nextjs.org/docs/app/api-reference/next-config-js/trailingSlash)                             | ✅                 |
| transpilePackages                | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/transpilePackages), [app](https://nextjs.org/docs/app/api-reference/next-config-js/transpilePackages)                     | ✅                 |
| turbo                            | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/turbo), [app](https://nextjs.org/docs/app/api-reference/next-config-js/turbo)                                             | 🔄                 |
| typedRoutes                      | [app](https://nextjs.org/docs/app/api-reference/next-config-js/typedRoutes)                                                                                                                  | ✅                 |
| typescript                       | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/typescript), [app](https://nextjs.org/docs/app/api-reference/next-config-js/typescript)                                   | ✅                 |
| urlImports                       | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/urlImports), [app](https://nextjs.org/docs/app/api-reference/next-config-js/urlImports)                                   | ✅                 |
| webpack                          | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/webpack), [app](https://nextjs.org/docs/app/api-reference/next-config-js/webpack)                                         | ✅                 |
| webVitalsAttribution             | [pages](https://nextjs.org/docs/pages/api-reference/next-config-js/webVitalsAttribution), [app](https://nextjs.org/docs/app/api-reference/next-config-js/webVitalsAttribution)               | ✅                 |

    - ✅: Supported
    - 🔄: Not currently supported, but it's probably possible and we may add support in the future
    - ❌: Not supported and unlikely we ever will support this
    - N/A: Not applicable

- _1_ - **compression**: [Cloudflare applies gzip or brotli compression](https://developers.cloudflare.com/support/speed/optimization-file-size/what-will-cloudflare-compress) automatically. When developing locally with Wrangler, no compression is applied.

- _2_ - **build indicator**: If you're developing using `wrangler pages dev`, it hard refreshes your application the indicator doesn't appear. If you run your app locally using `next dev`, this option works fine.

- _3_ - **setting custom build directory**: Applications built using `@cloudflare/next-on-pages` don't rely on the `.next` directory so this option isn't really applicable (the `@cloudflare/next-on-pages` equivalent is to use the `--outdir` flag).

- _4_ - **exportPathMap**: Option used for SSG not applicable for apps built using `@cloudflare/next-on-pages`.

- _5_ - **incrementalCacheHandlerPath**: The [Vercel Build Output API (v3) documentation](https://vercel.com/docs/build-output-api/v3#build-output-configuration) doesn't currently include specifications on how to handle the cache handler, so we'll have to wait until it does to properly implement this option.

- _6_ - **onDemandEntries**: Not applicable since it's an option for the Next.js server during development which we don't rely on.

- _7_ - **output**: `@cloudflare/next-on-pages` works with the standard Next.js output, `standalone` is incompatible with it, `export` is used to generate a static site which doesn't need `@cloudflare/next-on-pages` to run.

- _8_ - **productionBrowserSourceMaps**: The webpack chunks deduplication performed by `@cloudflare/next-on-pages` doesn't currently preserve source maps in any case so this option can't be implemented either. In the future we might try to preserver source maps, in such case it should be simple to also support this option.

- _9_ - **reactStrictMode**: Currently we build the application so react strict mode (being a local dev feature) doesn't work either way. If we can make strict mode work, this option will most likely work straight away.

- _10_ - **runtime configuration**: We could look into implementing the runtime configuration but it is probably not worth it since it is a legacy configuration and environment variables should be used instead.

- _11_ - **serverComponentsExternalPackages**: This option is for applications running on Node.js so it's not relevant to applications running on Cloudflare Pages.

### Internationalization

Besides the above mentioned `next.config.js` properties, there is also the `i18n` one, that is also fully supported meaning that `@cloudflare/next-on-pages` does support Next.js' built-in internationalization system. For more details on the option see the [Next.js Internationalization documentation](https://nextjs.org/docs/pages/building-your-application/routing/internationalization).

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

> Note that the `paths` array cannot be empty as that causes Next.js to ignore the provided `fallback` value, so make sure that at build time at least one entry is present in the array

#### Caching and Data Revalidation

Revalidation and `next/cache` are supported on Cloudflare Pages, and can use various bindings. For more information, see our [caching documentation](./caching).
