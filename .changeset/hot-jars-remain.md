---
"@cloudflare/next-on-pages": patch
---

Overwrite prerendered files if they already exist in the output directory.

When using `--skip-build`, it would fail if a prerendered file already existed, so we need to override the files so that the build process can continue like normal. This was problematic as after the first build, the prerendered files would now exist in the output directory as static assets, preventing any additional builds.
