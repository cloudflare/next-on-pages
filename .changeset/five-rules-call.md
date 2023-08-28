---
'@cloudflare/next-on-pages': patch
---

Fix `process.env` not being enumerable due to being a proxy.
