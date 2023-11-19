---
'@cloudflare/next-on-pages': patch
---

Fix broken `/__index.prefetch.rsc` rewrites that were being rewritten to `/__index` (and 404ing) due to to rsc suffix stripping that we do.
