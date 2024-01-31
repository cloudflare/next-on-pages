---
'@cloudflare/next-on-pages': major
---

replace `setupDevBindings` with `setupDevPlatform`

Previously developers would provide their bindings as inline options passed to
the `setupDevBindings` function (see: https://github.com/cloudflare/next-on-pages/tree/main/internal-packages/next-dev#how-to-use-the-module)

Such function has been renamed to `setDevPlatform` (a more generic name for future proofing) and of
requiring users to use inline options these changes make it so that `setupDevBindings` reads and gathers
the binding definitions from the user's `wrangler.toml` file instead, this is:

- consistent with the newly introduced `getBindingsProxy` utility (which is actually being used here under the hood)
  (https://developers.cloudflare.com/workers/wrangler/api/#getbindingsproxy)
- more convenient for users, since `wrangler pages dev` is also going to read the `wrangler.toml` file, making users
  only need to declare the bindings at most once for local development instead of twice
