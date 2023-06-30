# `next-on-pages/no-nodejs-runtime`

Only the edge runtime is available when using `@cloudflare/next-on-pages`, this rule makes sure that you never try to
set the `nodejs` runtime since that is going to break the application's build.

## ❌ Invalid Code

```js
export const runtime = 'nodejs';
                        ~~~~~~
```

## ✅ Valid Code

```js
export const runtime = 'edge';
```

```js
export const runtime = 'experimental-edge';
```
