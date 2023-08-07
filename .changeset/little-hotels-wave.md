---
'eslint-plugin-next-on-pages': patch
'@cloudflare/next-on-pages': patch
---

Add workaround so that people can use standard not-found routes in their app directory applications

The problem is that:

- if there's a static not-found route in app dir, that generates a serverless (edge incompatible) function (\_not-found)
- if there's a dynamic not-found route in app dir, that generates two serverless (edge incompatible) functions (\_not-found, \_error)

The workaround being introduced here is:

- if there's a static not-found route in app dir, we delete the generated \_not-found serverless function
  (which is not needed as we can just fallback to the static 404 html)
- if there's a dynamic not-found route in app dir, we can't actually fix it but provide a warning for the user

Besides the above the `no-app-not-found-runtime` eslint rule has been introduced to try to help developers avoid
the issue
