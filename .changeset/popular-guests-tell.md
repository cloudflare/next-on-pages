---
'@cloudflare/next-on-pages': patch
---

add `databaseId` to the `setupDevBindings` D1 binding type

D1 databases can only be referenced by their ID and not name, the current implementation
wrongly accepts the database name and uses it as the database id, in order to amend this
without introducing a breaking change we add an optional `databaseId` field to the D1 binding
type and present a warning if the only the `databaseName` is used.

When a better more stable/clear API will be decided for D1 bindings we can revisit this API.
