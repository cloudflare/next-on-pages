---
'@cloudflare/next-on-pages': patch
---

fix internal usage of `global` instead of `globalThis` (which causes some reference errors)
