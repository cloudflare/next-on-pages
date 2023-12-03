---
'@cloudflare/next-on-pages': patch
---

make CLI arguments parsing more flexible

prior to this change the CLI arguments parsing was not too flexible and forced a specific style

For instance the only way to provide an argument for the `outdir` option was to pass it using `=` as in:

```
-o=./my-dir
```

or

```
--outdir=./my-dir
```

these changes make the CLI arguments parsing more flexible and don't enforce a specific style
(`--outdir ./my-dir` now also works as you'd expect it to)
