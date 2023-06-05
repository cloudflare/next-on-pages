---
'@cloudflare/next-on-pages': patch
---

Fix middleware not returning a response with `new NextResponse` and when there is no `x-middleware-next` header present.
