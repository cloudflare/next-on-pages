---
'@cloudflare/next-on-pages': patch
---

Fix the Webpack chunk deduplication when Sentry is used, as it changes the AST node structure for Webpack chunks.
