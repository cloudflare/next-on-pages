---
'@cloudflare/next-on-pages': patch
---

allow any node built-in module to be statically imported correctly

currently only static imports from "node:buffer" work correctly, other
imports, although supported by the workers runtime, aren't handled correctly
(such as "node:events" and "node:util"), fix this by making sure we handle
imports from any of the node built-in modules

> **Note**
> some node built-in modules supported by the workers runtime still cannot be
> correctly imported (like "node:path" for example), but this is because they
> seem to be not allowed by vercel/next itself (so it's something unrelated to
> next-on-pages)
