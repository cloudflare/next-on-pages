---
'@cloudflare/next-on-pages': minor
---

make (no-op) `caches` available in dev mode

update `setupDevPlatform` to also add a `caches` object to the global scope
so that it can be used during development in a production-like manner

_note_: the implementation of `caches` is currently a no-op one
