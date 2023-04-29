---
'@cloudflare/next-on-pages': minor
---

New routing system runtime handling and implementation.

Improves support for advanced routing with Next.js applications on Pages, through leveraging the Vercel build output configuration. The Vercel build output specifies the relevant routing steps that are taken during the lifetime of a request, and this change implements a new system that handles these steps.
