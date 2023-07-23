---
'@cloudflare/next-on-pages': minor
---

add user-agent header to outgoing fetch requests

mimic Next.js' behavior of setting (if not already present) a `user-agent` header set to `Next.js Middleware`
see: https://github.com/vercel/next.js/blob/6705c803021d3bdea7fec20e5d98f6899e49836d/packages/next/src/server/web/sandbox/context.ts#L318-L320

this helps making next-on-pages more consistent with Next.js on Vercel
(it and can solve issues in which such header is necessary, as for example when making Github rest api calls,
see: https://github.com/cloudflare/next-on-pages/issues/376#issuecomment-1628416988)
