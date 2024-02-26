---
'@cloudflare/next-on-pages': patch
---

Improve the `getRequestContext`/`getOptionalRequestContext`'s behavior in the Node.js runtime

Currently if users run `getRequestContext` or `getOptionalRequestContext` in the Node.js runtime
they get a generic error saying that the request context could not be found, these changes
improve such situation by making it much clearer to the user that the error lies in the runtime
being used.

These changes make it so that when either function is used:

- if we can detect for a high level of certainty that the code is running in the Node.js runtime
  throw an error clearly stating that the wrong runtime is being used
- if we are not completely sure what runtime is being used (and the request context could not be
  retrieved) add a hint in the error message prompting the developer to double check that they
  are using the correct runtime (only applies to `getRequestContext`)
- if the (correct) edge runtime is being used we don't include this information at all.
