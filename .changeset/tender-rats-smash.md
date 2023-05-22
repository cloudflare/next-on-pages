---
'@cloudflare/next-on-pages': patch
---

fix getPackageVersion and use it to discern use of dlx

fix the `getPackageVersion` function so that it doesn't wrongly produce `N/A` (thus
improving the `-i|--info` results)

the when running `vercel build`, use the function to discern if `dlx` should be added
(for `yarn (berry)` and `pnpm` commands), ensuring that the vercel package is not
unnecessarily re-fetched/installed

> **Note**
> Currently the aforementioned check (and build command) runs `next-on-pages-vercel-cli`
> anyways that's a temporary solution, the changes here will also apply when we switch
> back to the proper vercel cli package
