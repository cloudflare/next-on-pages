---
'@cloudflare/next-on-pages': patch
---

Do not fix `_not-found` functions for applications only using the Pages Router

In https://github.com/cloudflare/next-on-pages/pull/418 we introduced a workaround
that would delete invalid (nodejs) `not-found` functions during the build process

Although the workaround is valid for applications using the App Router it is not
for applications only using the Pages Router, so make sure that it is not applied
in applications only using the latter
