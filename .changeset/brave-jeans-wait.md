---
'@cloudflare/next-on-pages': patch
---

Make `getRequestContext` and `getOptionalRequestContext` throw is used inside the Node.js runtime

Currently if users run `getRequestContext` or `getOptionalRequestContext` in the Node.js runtime
they get a generic error saying that the request context could not be found, improve such behavior
by having the functions throw instead, clearly informing the user that the problem is the wrong
runtime being used
