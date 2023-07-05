---
'@cloudflare/next-on-pages': patch
---

deduplicate Next.js manifests

Currently in our functions files we have end up having a number of Next.js internally used manifest objects duplicated.
These manifests increase as the number of routes increases making the size effects of the duplication quite problematic for medium/large applications
(for small applications the manifest duplication is not as problematic).

This change removes such duplication by making sure that we only include each type of manifest once and share such javascript object across the various functions instead (significantly decreasing the output size of medium/large next-on-pages applications).
