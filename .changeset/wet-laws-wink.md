---
'@cloudflare/next-on-pages': patch
---

watch mode only on file changes

only watch for file changes instead of watching for all possible changes (such as directories additions/removals, etc...),
making sure that we don't rerun the build process unnecessarily
