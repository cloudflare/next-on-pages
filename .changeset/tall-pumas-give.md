---
"eslint-plugin-next-on-pages": patch
---

add fallback detection check in no-unsupported-configs rule

add an additional check in the no-unsupported-configs rule so that if the rule
were to fail detecting the config's name as a last resort we fall back checking
the variable declaration present just after the "/** @type {import('next').NextConfig} */"
comment
