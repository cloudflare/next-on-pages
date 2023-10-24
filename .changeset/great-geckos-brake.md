---
'@cloudflare/next-on-pages': patch
---

Fix prerendered `next.config.js` `basePath` root infinite redirect due to Cloudflare Pages handling of `/{path}/index`.
