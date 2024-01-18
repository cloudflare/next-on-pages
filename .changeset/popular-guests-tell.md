---
'@cloudflare/next-on-pages': patch
---

add `databaseId` variant for D1s to the `setupDevBindings` D1 binding type

D1 databases can only be referenced by their ID and not name, the current implementation
wrongly accepts the database name and uses it as the database id, in order to amend this
without introducing a breaking change we add a variant of the D1 binding type that accepts
a `databaseId` field instead of the `databaseName` for the binding and we present a warning
to users if the `databaseName` is used instead.

When a better more stable/clear API will be decided for D1 bindings we can revisit this API.
