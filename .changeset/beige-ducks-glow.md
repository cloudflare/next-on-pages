---
'@cloudflare/next-on-pages': patch
---

Make the `getRequestContext`'s error message more helpful during local development

During local development add information in the `getRequestContext`'s error
message reminding the user to setup the dev platform via `setupDevPlatform`
in their config file
