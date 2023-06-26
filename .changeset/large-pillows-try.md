---
'@cloudflare/next-on-pages': patch
---

Prevent middleware redirects applying search params.

When a middleware function results in a redirect, the location header specified in the response is the full destination, including any search params, as written by the developer. Previously, we always applied search params to redirects found during the routing process, no matter what. This meant that we accidentally were applying search params to middleware redirects, which would alter the intended final destination. This change prevents that from happening.
