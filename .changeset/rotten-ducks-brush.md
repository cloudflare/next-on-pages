---
'@cloudflare/next-on-pages': patch
---

add pnpm files to ignored list for watch mode

add the following files to the list of files we ignore for watch mode:

- `pnpm-lock.yaml`: for consistency since all the other lock files are ignored
- `.pnpm-store`: to prevent potential infinite loops (https://github.com/cloudflare/next-on-pages/issues/212)
- `_tmp_*`: to prevent infinite loops, this is needed because pnpm saves/deletes temporary files to get the relative path to its store (https://github.com/pnpm/pnpm/blob/3f85e75dad4f5560a17367e5faad5a387bd47d05/store/store-path/src/index.ts#L41), such files start with `_tmp_` (see: https://github.com/zkochan/packages/blob/f559aef5b63c2477dd72ce156f35d6111af780f6/path-temp/index.js#L6)
