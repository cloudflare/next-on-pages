---
'@cloudflare/next-on-pages': patch
---

suppress invalid env variables on `process.env` in the `next-dev` submodule

improve `setupDevPlatform` so that it suppresses the environment variables (present
in the edge runtime) that the Next.js dev server sets on `process.env` (such should not
be used anyways since they won't be available in the preview nor in the deployed app)
