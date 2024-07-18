---
'@cloudflare/next-on-pages': patch
---

fix: implement route specific global scoping strategy

currently routes all share the same global scope, this can be problematic and cause
race conditions and failures

One example of this is the following code that is present in route function files:

```ts
self.webpackChunk_N_E = ...
```

and

```ts
self.webpackChunk_N_E.push(...)
```

this indicates that an in-memory global collection of the webpack chunks is shared by all routes,
this combined with the fact that chunks can have their own module state this can easily cause routes
to conflict with each other at runtime.

So, in order to solve the above issue wrap every route function in a function wrapper which
accepts as parameters, thus overrides, the `self`, `globalThis` and `global` symbols. The symbols
are then to be resolved with proxies that redirect setters to route-scoped in-memory maps and
getters to the above mentioned map's values and fallback to the original symbol values otherwise
(i.e. `globalThis` will be overridden by a proxy that, when setting values, sets them in a separate
location and, when getting values, gets them from said location if present there or from the real
`globalThis` otherwise)
