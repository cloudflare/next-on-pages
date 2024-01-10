---
'@cloudflare/next-on-pages': patch
---

fix: ensure Durable Object stub proxies fetch Durable Objects and not their containing Worker

Previously, calling `DurableObjectStub#fetch()` would dispatch a `fetch` event to the Worker containing the target Durable Object, not the Durable Object itself. This change ensures the `fetch` event is dispatched directly to the Durable Object.
