---
'@cloudflare/next-on-pages': patch
---

avoid the default is not a function unclear error

if there is some issue evaluating a lazy loaded edge function
its default export ends up not being a function and that results
in an unhelpful error like the following:

```
 TypeError: u.default is not a function
```

slightly improve the user experience by catching such error and
letting the user know that something went wrong with the edge
function's evaluation:

```
 Error: An error occurred while evaluating the target edge function (<edge-function-path>)
```
