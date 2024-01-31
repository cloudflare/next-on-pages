---
'eslint-plugin-next-on-pages': major
---

remove the no longer valid `no-app-not-found-runtime` rule

The `no-app-not-found-runtime` rule has been sort-removed in https://github.com/cloudflare/next-on-pages/pull/600
as it is no longer required/valid, the changes here are removing the rule entirely (this would cause users using
the rule in their existing application to error, thus this is a breaking change)
