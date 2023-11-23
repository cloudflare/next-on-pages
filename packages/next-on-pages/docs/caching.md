# Caching and Data Revalidation

`@cloudflare/next-on-pages` comes with support for data revalidation and caching for fetch requests. This is done in our router and acts as an extension to Next.js' built-in functionality.

## Storage Options

There are various different bindings and storage options that one could use for caching. At the moment, `@cloudflare/next-on-pages` supports the Cache API and Workers KV out-of-the-box.

In the future, support will be available for creating custom cache interfaces and using different bindings.

### Cache API

The [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) is a per data-center cache that is ideal for storing data that is not required to be accessible globally. It is worth noting that Vercel's Data Cache is regional, like with the Cache API, so there is no difference in terms of data availability.

Due to how the Cache API works, you need to be using a domain for your deployment for it to take effect.

### Workers KV

[Workers KV](https://developers.cloudflare.com/kv/) is a low-latency key-value store that is ideal for storing data that should be globally distributed. KV is eventually consistent, which means that it will take up to 60 seconds for updates to be reflected globally.

To use Workers KV for caching, you need to add a binding to your Pages project with the name `__NEXT_ON_PAGES__KV_SUSPENSE_CACHE`, and map it to a KV namespace.
