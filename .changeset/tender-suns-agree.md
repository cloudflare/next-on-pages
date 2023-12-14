---
'@cloudflare/next-on-pages': patch
---

ignore invalid `_error` functions in the App router

In the App router, error boundaries are implemented as client components (see: https://nextjs.org/docs/app/api-reference/file-conventions/error),
meaning that they should not produce server side logic.

The Vercel build process can however generate `_error.func` lambdas (as they are useful in the
Vercel network I'd assume), through experimentation we've seen that those do not seem to be
necessary when building the application with next-on-pages so they should be safe to ignore.

The changes here make such invalid `_error.func` lambdas (if present) ignored (as they would otherwise
cause the next-on-pages build process to fail)
