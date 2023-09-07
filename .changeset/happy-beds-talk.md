---
'@cloudflare/next-on-pages': minor
---

Add new `helpers` sub-module with `getRequestExecutionContext`.

Add a new `helpers` module that will provide utilities that will allow developer to utilize better next-on-pages and the cloudflare platform.

The `getRequestExecutionContext` function has been introduced with helpers.
This function provides an execution context object (`ctx`) to the developer.

This function throws an error when executed on the client.
This function also returns a mocked context when executed in a non pages environment.
This is useful when executing unit tests, for example, as it prevents errors from occurring.
