# `eslint-plugin-next-on-pages`

`eslint-plugin-next-on-pages` lints your Next.js app to ensure it is configured to work on Cloudflare Pages.

## Setup

To install the plugin run:

```sh
 npm i --save-dev eslint-plugin-next-on-pages
```

Add the plugin to your `.eslintrc.json`:

```diff
{
  "plugins": [
+    "next-on-pages"
  ],
  "extends": [
+    // apply the recommended rules
+    "plugin:next-on-pages/recommended"
  ],
  "rules": {
+    // specify or tweak the rules
+    "next-on-pages/no-unsupported-configs": "warn"
  }
}
```

## Rules

- [`next-on-pages/no-app-nodejs-dynamic-ssg`](https://github.com/cloudflare/next-on-pages/tree/main/packages/eslint-plugin-next-on-pages/docs/rules/no-app-nodejs-dynamic-ssg)
- [`next-on-pages/no-nodejs-runtime`](https://github.com/cloudflare/next-on-pages/tree/main/packages/eslint-plugin-next-on-pages/docs/rules/no-app-nodejs-runtime)
- [`next-on-pages/no-pages-nodejs-dynamic-ssg`](https://github.com/cloudflare/next-on-pages/tree/main/packages/eslint-plugin-next-on-pages/docs/rules/no-pages-nodejs-dynamic-ssg)
- [`next-on-pages/no-unsupported-configs`](https://github.com/cloudflare/next-on-pages/tree/main/packages/eslint-plugin-next-on-pages/docs/rules/no-unsupported-configs)
