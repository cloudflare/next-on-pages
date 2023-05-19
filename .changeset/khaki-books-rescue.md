---
'@cloudflare/next-on-pages': minor
---

add new `utils` sum-module with `getRequestCfProperties` and `getRequestExecutionContext`

add a new `utils` module that will provide utilities that will allow developer to utilize
better next-on-pages and the cloudflare platform.

alongside the `utils` two functions have been introduced `getRequestCfProperties` and
`getRequestExecutionContext`, the former provides to developers the `cf` object from
the request, whilst the latter the execution context object (`ctx`), both results
are properly typed (with the types coming from `@cloudflare/workers-types`).

Note that naturally both only work on the server, they throw an exception if run on the client,
where there is not request to get the objects from.

Usage example:

```ts
import {
	getRequestCfProperties,
	getRequestExecutionContext,
} from '@cloudflare/next-on-pages/utils';

// ...

const cf = getRequestCfProperties();
// access cf.colo, cf.city, etc...

const ctx = getRequestExecutionContext();
// ctx.waitUntil(myPromise), etc...
```
