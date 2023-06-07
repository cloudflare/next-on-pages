---
'@cloudflare/next-on-pages': patch
---

Fix `set-cookie` headers overriding when more than one is set, instead of appending.
