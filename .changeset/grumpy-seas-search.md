---
'@cloudflare/next-on-pages': patch
---

Remove rsc functions from the worker output directory as we replace them with non-rsc variants in the config given to the router. This reduces the final bundle size.
