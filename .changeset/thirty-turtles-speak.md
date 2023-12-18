---
'@cloudflare/next-on-pages': patch
---

Make route matching check handle better trailing slashes

Currently having `trailingSlash` set to `true` in the `next.config.js` file
results in some routes not being correctly handled, this fix addresses such
issue
