---
'@cloudflare/next-on-pages': patch
---

Fix static route handling in the app directory and copy prerendered routes to the build output static directory.

If an app directory projets builds pages without specifying a runtime and has no server-side functionality, it defaults to generating static pages. These pages are in the form of prerendered routes, which are stored in the build output directory with prerender configs, fallback files, and functions. The functions it creates are not necessary and will be invalid nodejs functions as no runtime was specified, and the fallback files can instead be used as static assets for the pages.
