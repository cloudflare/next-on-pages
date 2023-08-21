# Caching and Data Revalidation

`@cloudflare/next-on-pages` comes with support for data revalidation and caching for fetch requests. This is done in our router and acts as an extension to Next.js' built-in functionality.

## Storage Options

There are various different bindings and storage options that one could use for caching. At the moment, `@cloudflare/next-on-pages` supports the Cache API out-of-the-box.

In the future, support will be available for creating custom cache interfaces and using different bindings.

### Cache API

The [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) is a per data-center cache that is ideal for storing data that is not required to be accessible globally. It is worth noting that Vercel's Data Cache is regional, like with the Cache API, so there is no difference in terms of data availability.

Due to how the Cache API works, you need to be using a domain for your deployment for it to take effect.
