---
'eslint-plugin-next-on-pages': minor
---

add new `no-pages-nodejs-dynamic-ssg` rule

add the new `no-pages-nodejs-dynamic-ssg` rule that makes sure that
developers using `getStaticPaths` set the `fallback` property to `false`
or opt in into the `edge` runtime
