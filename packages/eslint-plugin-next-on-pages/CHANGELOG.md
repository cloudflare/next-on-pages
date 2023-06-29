# eslint-plugin-next-on-pages

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
