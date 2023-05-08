---
'@cloudflare/next-on-pages': major
---

introduce `cloudflare` platform object containing all the cloudflare context relative to the request

introduce a `cloudflare` platform object so that user code can access `env`, `ctx` and `cf` from there

the cloudflare object is accessible via `process.env.cloudflare`

this is a breaking change because previously applications would get their cloudflare bindindings directly
from `process.env` whilst not the need to go through the `cloudflare` object.

so if the user has a `my-binding` binding before they would access it via: `process.env['my-binding']`
but now they'd access it via `process.env.cloudflare['my-binding']`
