---
'@cloudflare/next-on-pages': patch
---

Reinstate the use of the package-manager-manager package introduced in #474 and temporarily removed in #475,
this fixes the bug that was caused by the package by bumping the package itself (where the bug has been fixed)
and adding appropriate catches when the package methods can throw (in case other unexpected issues arise in the
future)
