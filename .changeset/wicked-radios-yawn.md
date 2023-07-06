---
'@cloudflare/next-on-pages': patch
---

avoid extracting chunks when unnecessary

As part of our lazy loading implementation (see https://github.com/cloudflare/next-on-pages/blob/main/docs/technical/lazy-loading.md)
we extract chunks that are used by different routes into separate functions and import those functions in the route files, this allows
us not to duplicate chunks code.

This change here makes sure that only the chunks that are actually used by multiple routes get extracted as there isn't a real benefit
in extracting into separate files chunks that are used by single routes, on the contrary it actually adds overhead and increases
the number of files produced, which for large next-on-pages applications might be problematic.
