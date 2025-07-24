---
'@cloudflare/next-on-pages': patch
---

ignore invalid rsc lambdas created for prerendered functions

As of vercel@44.5.4 incorrect lambda rsc functions get generated for prerendered routes, the changes here make sure that such routes get ignored
