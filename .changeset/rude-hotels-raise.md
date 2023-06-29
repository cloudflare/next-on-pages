---
"@cloudflare/next-on-pages": patch
---

Fix middleware returning `new NextResponse` resulting in 404 for routes that don't exist in the build output.
