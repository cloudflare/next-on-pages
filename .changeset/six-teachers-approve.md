---
'@cloudflare/next-on-pages': patch
---

fix `require("node:buffer")` breaking applications

Next seems to have started relying on `node:buffer` this nodejs module is supported by the workers
runtime but it fails the \_worker.js build because `node:buffer` isn't recognized by esbuild (since
we're not bundling for node), simply adding it to the externals option of the build command doesn't
seem to work since it generates dynamic require calls which fail at runtime.

So this change also adds an esbuild plugin so that the dynamic require calls to `node:buffer`
get converted to requires to a new file which statically exports all entries from `node:buffer`,
effectively removing the problematic require calls whilst allowing the use of `node:buffer` entries.
