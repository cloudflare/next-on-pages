---
'@cloudflare/next-on-pages': patch
---

bundle assets produced by the Vercel build and make them accessible via fetch

Vercel/Next can allow access binary assets bundled with their edge functions in the following manner:

```
const font = fetch(new URL('../../assets/asset-x', import.meta.url)).then(
  (res) => res.arrayBuffer(),
);
```

As you can see in this `@vercel/og` example:
https://vercel.com/docs/concepts/functions/edge-functions/og-image-generation/og-image-examples#using-a-custom-font

This sort of access to bindings is necessary for the `@vercel/og` package to work and might be used in other packages
as well, so it is something that we need to support.
We do so by making sure that we properly bind the assets found in the Vercel build output into our worker
and that fetches to such assets (using blob urls) are correctly handled (this requires us to patch the global `fetch` function)
