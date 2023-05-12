---
'@cloudflare/next-on-pages': minor
---

add nodejs_compat runtime check

add a runtime check for the presence of the nodejs_compat flag at runtime so that if developers
forget to use such flag instead of receiving an internal server error they receive an error specifically
telling them that they have not specified the flag
