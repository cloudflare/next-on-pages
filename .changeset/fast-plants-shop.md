---
'@cloudflare/next-on-pages': minor
---

Add new static error page that informs users when they forgot to set the `nodejs_compat` flag.
This should be clearer that the simple text message we've been providing previously (which is
still being used as a fallback in case the new page is not available for some reason).
