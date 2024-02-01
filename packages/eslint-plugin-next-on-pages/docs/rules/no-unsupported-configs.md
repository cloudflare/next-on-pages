# `next-on-pages/no-unsupported-configs`

`@cloudflare/next-on-pages` doesn't support all config options that are supported by Next in their `next.config.mjs` file.

As documented in the [support documentation](https://github.com/cloudflare/next-on-pages/blob/main/docs/supported.md#nextconfigjs-properties) there are config options that: we support, we don't currently support, we support and don't plan to.

This rule helps you making sure that your code is not using config options that aren't supported by `@cloudflare/next-on-pages` (it always reports config options that we don't plan on supporting, other options can be set/unset using the rule's options).

## Rule Options:

- **`includeCurrentlyUnsupported`** (`type: boolean`, `default: true`)
  Indicates if config options that we plan on supporting but we currently don't should be reported.
- **`includeUnrecognized`** (`type: boolean`, `default: false`)\
  Indicates if config options that haven't tested/documented should be reported (they might or might not be actually supported).

## ❌ Invalid Code

```js
// eslintrc
"next-on-pages/no-unsupported-configs": "error"


// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  ~~~~~~~~
}

export default nextConfig
```

```js
// eslintrc
"next-on-pages/no-unsupported-configs": "error"


// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  ~~~~~~~~~~~~~
}

export default nextConfig
```

```js
// eslintrc
"next-on-pages/no-unsupported-configs": [
  "error", { "includeUnrecognized": true }
]


// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  nonExistingConfig: 'test',
  ~~~~~~~~~~~~~~~~~
}

export default nextConfig
```

## ✅ Valid Code

```js
// eslintrc
"next-on-pages/no-unsupported-configs": "error"


// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['page.tsx'],
}

export default nextConfig
```

```js
// eslintrc
"next-on-pages/no-unsupported-configs": [
  "error", { includeCurrentlyUnsupported: false }
]


// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
}

export default nextConfig
```

```js
// eslintrc
"next-on-pages/no-unsupported-configs": "error"


// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  nonExistingConfig: 'test',
}

export default nextConfig
```
