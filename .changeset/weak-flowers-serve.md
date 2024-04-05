---
'@cloudflare/next-on-pages': patch
---

normalize multi segments paths so that paths are split over multiple query params

it seems like some paths such as `/[[...path]]?path=a/b/c/d` (created in the rewrite
routing phase) can be wrongly used can cause routing issues, such issues can be solved
by "normalizing" the path such as `/[[...path]]?path=a&path=b&path=c&path=d`, so always
apply such normalization when possible
