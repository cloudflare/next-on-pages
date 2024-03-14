---
'eslint-plugin-next-on-pages': minor
---

add new `no-app-nodejs-dynamic-ssg` rule

add the new `no-app-nodejs-dynamic-ssg` rule that makes sure that
developers using `generateStaticParams` also export either the `runtime`
variable set to `edge` or the `dynamicParams` one set to `false`
