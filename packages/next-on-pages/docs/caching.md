# Caching and Data Revalidation

`@cloudflare/next-on-pages` comes with support for data revalidation and caching for fetch requests. This is done in our router and acts as an extension to Next.js' built-in functionality.

## Zero Configuration Options

The following are two different caching implementation options that don't require any code nor configuration change.

### Workers Cache API

The [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) is a per data-center cache that is ideal for storing data that is not required to be accessible globally. It is worth noting that Vercel's Data Cache is regional, like with the Cache API, so there is no difference in terms of data availability.

Due to how the Cache API works, you need to be using a domain for your deployment for it to take effect.

Besides the above requirement, no other action is needed to use this option.

### Workers KV

[Workers KV](https://developers.cloudflare.com/kv/) is a low-latency key-value store that is ideal for storing data that should be globally distributed. KV is eventually consistent, which means that it can take up to 60 seconds for updates to be reflected globally.

To use this option all you need to add a binding to your Pages project with the name `__NEXT_ON_PAGES__KV_SUSPENSE_CACHE`, and map it to a KV namespace.

## Custom Cache Handler

In case a custom solution is needed (for example in order to integrate with a third party storage solution or integrate with different [Cloudflare Bindings](https://developers.cloudflare.com/pages/functions/bindings/)) you will need to implement your own logic and register it via the Next.js [incrementalCacheHandlerPath](https://nextjs.org/docs/app/api-reference/next-config-js/incrementalCacheHandlerPath) option.
