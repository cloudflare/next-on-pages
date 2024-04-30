---
'@cloudflare/next-on-pages': patch
---

update `package.json` to properly export the typescript types

the current types are declared in the `package.json` via `typesVersions`
such don't seem to get picked up correctly by all package managers, to for
the types use the `package.json` `exports` field instead
