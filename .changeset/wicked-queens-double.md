---
'@cloudflare/next-on-pages': minor
---

add the ability to ignore routes via `--ignore-routes`|`-r` flag

add the ability to ignore routes during the `@cloudflare/next-on-pages` building process, this
can be used to ignore routes which Next.js currently can't build for the edge (like for example
`_error`)

it could also be used for the incremental migration of an existing application using the nodejs
runtime to the Cloudflare network by ignoring all the routes that still need to migrate

this should however be used very sparingly as a last resort when there are no other alternatives
since ignoring routes means loosing functionality

Usage example:

```
 $ npx @cloudflare/next-on-pages -r="api/hello" -r="_error"
```
