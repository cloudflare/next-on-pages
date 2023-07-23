# eslint-plugin-next-on-pages

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
