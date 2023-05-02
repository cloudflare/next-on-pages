---
'@cloudflare/next-on-pages': minor
---

make the experimental minification the default behavior and add an option to disabled it

as part of this:

- make `--experimental-minify`|`-e` a no-op argument which simply shows a warning which indicates that it is
  a deprecated option (we aren't removing the flag so that we don't break existing build scripts)
- add a `--disable-worker-minification`|`-m` option to disable the minification of the \_worker.js script (which
  currently coincides with the experimental minification)
