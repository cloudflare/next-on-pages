---
'@cloudflare/next-on-pages': patch
---

move the invalidFunctions check before the no-functions one

currently if a build contains only invalid functions we'd be presenting a log
saying that no function was found and simply return the static assets as if
everything is correct, this is because we check for invalid functions only
after checking if there are any (valid) ones, this change moves the invalid
functions check so that is performed first, making sure that the described case
successfully errors
