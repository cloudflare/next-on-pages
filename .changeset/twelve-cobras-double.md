---
'@cloudflare/next-on-pages': minor
---

Add support for using a KV to implement the Suspense Cache via naming convention

With this change users can have their suspense cache implemented via a KV binding, in order to
opt-in to such implementation they simply need to make sure that their application has a KV binding
named `__NEXT_ON_PAGES__KV_SUSPENSE_CACHE` (the next-on-pages worker will pick up such
binding and use it to implement the suspense cache instead of using the default workers cache API).
