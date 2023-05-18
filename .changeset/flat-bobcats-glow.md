---
'@cloudflare/next-on-pages': patch
---

introduce wasm support

introduce wasm support by tweaking how the wasm modules are imported, what `vercel build` does is adding dynamic
requires at the top of the func files, like for example:
```js
  // file: .vercel/output/functions/index.func/index.js
  const wasm_fbeb8adedbc833032bda6f13925ba235b8d09114 = require("/wasm/wasm_fbeb8adedbc833032bda6f13925ba235b8d09114.wasm");
```
then such identifier is used in the rest of the file (likely only inside chunks), as in:
```js
    // file: .vercel/output/functions/index.func/index.js
    649:e=>{e.exports=wasm_fbeb8adedbc833032bda6f13925ba235b8d09114}
```

the above can't work with next-on-pages because:
 - dynamic requires are not supported
 - when we perform the chunks deduplication chunks containing such identifiers will not find their declaration causing
    (e.g. a chunk file containing the `649` chunk code illustrated above won't know where `wasm_fbeb8adedbc833032bda6f13925ba235b8d09114`
    comes from and would just provide a runtime error saying that it is not defined)
 - `/wasm/...` isn't a real directory, just some sort of convention used by vercel, the wasm files are located in the same
    directory as the func file

the adopted solution consists in:
 - copying the wasm files from their func relative locations into the `__next-on-pages-dist/wasm` directory
 - converting the func top level requires into standard relative esm imports, like for example:
   ```js
    // file: .vercel/output/functions/index.func/index.js
    import wasm_fbeb8adedbc833032bda6f13925ba235b8d09114 from"../wasm/wasm_fbeb8adedbc833032bda6f13925ba235b8d09114.wasm";
   ```
   so that any part of the func file will be able to reference the variable (so that this works with chunks deduplication disabled)
 - adding such relative imports in the chunk files themselves (only to chunk files actually using some of the identified wasm
   identifiers), like for example:
   ```js
    // file: .vercel/output/static/_worker.js/__next-on-pages-dist__/chunks/649.js
    import wasm_fbeb8adedbc833032bda6f13925ba235b8d09114 from '../wasm/wasm_fbeb8adedbc833032bda6f13925ba235b8d09114.wasm';
    var a=b=>{b.exports=wasm_fbeb8adedbc833032bda6f13925ba235b8d09114};export{a as default};
   ```
  (so that this works with chunks deduplication enabled)