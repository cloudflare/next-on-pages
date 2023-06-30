# `eslint-plugin-next-on-pages`

`eslint-plugin-next-on-pages` is an ESlint plugin intended to support developers developing Next.js application via `@cloudflare/next-on-pages`.

## Setup

To install the plugin run:

```sh
 npm i --save-dev eslint-plugin-next-on-pages@V
```

where `V` indicates the version of your `@cloudflare/next-on-pages` package.

> **Note**
> The `eslint-plugin-next-on-pages` package is versioned identically to `@cloudflare/next-on-pages`, this can be used to ensure that the two packages are in sync with each other. For best results make sure that the versions of the two packages are always the same.

Then simply register the plugin in your eslintrc file. As part of this we suggest to also extend the recommended configuration. After that you can also further tweak the available rules:

```diff
// .eslintrc.json
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
+    "next-on-pages/missing-image-loader": "error"
  }
}
```

## Rules

For more details check out the [rules documentation](https://github.com/cloudflare/next-on-pages/tree/main/packages/eslint-plugin-next-on-pages/docs/rules).
