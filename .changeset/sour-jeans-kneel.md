---
'@cloudflare/next-on-pages': patch
---

fix applications using Next.js v.14.2.0-canary.18 and up

In v.14.2.0-canary.18 a simple upstream change in Next.js changes the code that
next-on-pages receives, nullifying a find-and-replace regex that next-on-pages
is currently relying on, update such regex so that it can handle the new code
