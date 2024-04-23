# eslint-plugin-next-on-pages

## 1.11.1

## 1.11.0

### Minor Changes

- 702f601: add new `no-app-nodejs-dynamic-ssg` rule

  add the new `no-app-nodejs-dynamic-ssg` rule that makes sure that
  developers using `generateStaticParams` also export either the `runtime`
  variable set to `edge` or the `dynamicParams` one set to `false`

- 82aa1a4: add new `no-pages-nodejs-dynamic-ssg` rule

  add the new `no-pages-nodejs-dynamic-ssg` rule that makes sure that
  developers using `getStaticPaths` set the `fallback` property to `false`
  or opt in into the `edge` runtime

## 1.10.0

## 1.9.0

## 1.8.6

## 1.8.5

## 1.8.4

## 1.8.3

### Patch Changes

- ed9a4ac: remove the no-longer-necessary `no-app-not-found-runtime` rule in a backward compatible manner
- 72426c2: update `no-unsupported-configs` with new configs options

  in the `no-unsupported-configs` rule handle the following new options:

  - logging
  - optimizePackageImports
  - ppr (Partial Prerendering)
  - serverActions

## 1.8.2

## 1.8.1

## 1.8.0

## 1.7.4

### Patch Changes

- 48796ca: Support for using src folder with no-app-not-found-runtime lint rule
- 48796ca: Use correct name for export of no-app-not-found-runtime lint rule
- c9167ea: Support for file extensions .mjs in no-unsupported-configs ESLint rule

## 1.7.3

## 1.7.2

## 1.7.1

## 1.7.0

## 1.6.3

## 1.6.2

## 1.6.1

## 1.6.0

## 1.5.1

### Patch Changes

- 5bfbbe1: Add workaround so that people can use standard not-found routes in their app directory applications

  The problem is that:

  - if there's a static not-found route in app dir, that generates a serverless (edge incompatible) function (\_not-found)
  - if there's a dynamic not-found route in app dir, that generates two serverless (edge incompatible) functions (\_not-found, \_error)

  The workaround being introduced here is:

  - if there's a static not-found route in app dir, we delete the generated \_not-found serverless function
    (which is not needed as we can just fallback to the static 404 html)
  - if there's a dynamic not-found route in app dir, we can't actually fix it but provide a warning for the user

  Besides the above the `no-app-not-found-runtime` eslint rule has been introduced to try to help developers avoid
  the issue

## 1.5.0

## 1.4.0

## 1.3.1

## 1.3.0

### Minor Changes

- f1f5a95: remove eslint `missing-image-loader` rule

  the `missing-image-loader` rule is no longer needed since `@cloudflare/next-on-pages`
  version 1.3.0 as basic support for the `Image` component has been introduced
  (in the following PR: https://github.com/cloudflare/next-on-pages/pull/357), therefore there isn't
  a real need to warn developers not to use the `Image` component without a custom loader
  (since the component will just work by default).

  > **Warning**
  > This is technically a breaking change to the `eslint-plugin-next-on-pages` package
  > since linting would break for users specifically including the `missing-image-loader`
  > rule (causing `Definition for rule 'next-on-pages/missing-loader' was not found` errors)
  > however currently we don't assume that many people are using the plugin with the rule
  > specifically included, moreover the resolution for the breaking change is to simply
  > remove the rule from the application's eslint configuration so it is also extremely
  > simple to fix, thus we didn't consider this worth a major bump

## 1.2.0

### Patch Changes

- daa32fd: update no-unsupported-config rules (to match the latest supported configs table)
- c21c995: add fallback detection check in no-unsupported-configs rule

  add an additional check in the no-unsupported-configs rule so that if the rule
  were to fail detecting the config's name as a last resort we fall back checking
  the variable declaration present just after the "/\*_ @type {import('next').NextConfig} _/"
  comment

## 1.1.1

## 1.0.3
