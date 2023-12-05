---
'@cloudflare/next-on-pages': patch
---

Fix `_not-found` functions only for applications using the App Router

In https://github.com/cloudflare/next-on-pages/pull/418 we introduced a workaround
that would delete invalid (nodejs) `_not-found` functions during the build process

Although the workaround is valid for applications using the App Router it is not
for applications only using the Pages Router, so make sure that it is only applied
when the former is used
