---
'@cloudflare/next-on-pages': patch
---

make sure that server actions can work in `wrangler pages dev`

fix `wrangler pages dev` breaking server actions because of a misalignment between headers
where some use `localhost` and others `127.0.0.1` (causing server actions not to work because
they don't recognize the host origin)
