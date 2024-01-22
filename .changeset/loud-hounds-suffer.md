---
'@cloudflare/next-on-pages': major
---

make `setupDevBindings` rely on a `wrangler.toml` instead of accepting inline options

Previously developers would provide their bindings as inline options passed to
the `setupDevBindings` function (see: https://github.com/cloudflare/next-on-pages/tree/main/internal-packages/next-dev#how-to-use-the-module)

Instead of requiring users to use inline options these changes make it so that `setupDevBindings`
reads and gathers the binding definitions from the user's `wrangler.toml` file instead, this is:

- consistent with the newly introduced `getBindingsProxy` utility (which is actually being used under the hood)
  (https://developers.cloudflare.com/workers/wrangler/api/#getbindingsproxy)
- more convenient for users, since `wrangler pages dev` is also going to read the `wrangler.toml` file, making users
  only need to declare the bindings at most once for local development instead of twice
