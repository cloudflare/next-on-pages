---
'@cloudflare/next-on-pages': major
---

use and rely on AsyncLocalStorage

previously we've been using the node AsyncLocalStorage in a non-breaking way but now we are committing
to in and using it to store the global env variables as well

this is a breaking change since moving forward all app running using @cloudflare/next-on-pages must
have the nodejs_compat compatibility flag set (before not all needed that)
