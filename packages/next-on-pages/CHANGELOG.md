# @cloudflare/next-on-pages

## 1.2.0

### Minor Changes

- 2f9cf97: Support for using a custom output directory for the generated worker and static assets, through a `--outdir` flag.

### Patch Changes

- f879ffd: Prevent middleware redirects applying search params.

  When a middleware function results in a redirect, the location header specified in the response is the full destination, including any search params, as written by the developer. Previously, we always applied search params to redirects found during the routing process, no matter what. This meant that we accidentally were applying search params to middleware redirects, which would alter the intended final destination. This change prevents that from happening.

- 6212bfd: Fix entrypoint not being resolved.
- 3a95489: Fix middleware returning `new NextResponse` resulting in 404 for routes that don't exist in the build output.
- 2dceb75: Fix middleware being invoked multiple times in a phase during routing when there is more than one config entry.

## 1.1.1

### Minor Changes

- 2c87481: Display a summary about the build at the end of the build process.

### Patch Changes

- b1c3a33: fix --info showing [object Promise] for relevant packages instead of their versions
- a9b8c3c: Overwrite prerendered files if they already exist in the output directory.

  When using `--skip-build`, it would fail if a prerendered file already existed, so we need to override the files so that the build process can continue like normal. This was problematic as after the first build, the prerendered files would now exist in the output directory as static assets, preventing any additional builds.

- b1c3a33: fix vercel command not found issue

## 1.1.0

### Minor Changes

- 1be5e72: Support for the `wildcard` option in the Vercel build output config.

### Patch Changes

- 783dc79: Added package.json to list of ignored files in watch mode to ensure compatibility with yarn (classic)
- fb818bf: Fix i18n locale index routes not matching for SSR'd index pages.
- 016b8d3: Fix `set-cookie` headers overriding when more than one is set, instead of appending.
- d835933: Prevent the route group stripping regex from removing intercept routes.

## 1.0.2

### Patch Changes

- f687d25: update the runtime error message so that it provides accurate up-to-date information
- ff90dde: Remove rsc functions from the worker output directory as we replace them with non-rsc variants in the config given to the router. This reduces the final bundle size.
- cb62938: Fix dynamic params not being derived correctly in some cases when running a page's function.
- d91b24b: Fix middleware not returning a response with `new NextResponse` and when there is no `x-middleware-next` header present.
- 7deb9d8: Fix non-index pages with trailing slash rewriting to /index for rsc requests.

## 1.0.1

### Patch Changes

- 29b7547: improve no nodejs_compat flag runtime error message
- c0ecec3: introduce wasm support

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
    import wasm_fbeb8adedbc833032bda6f13925ba235b8d09114 from "../wasm/wasm_fbeb8adedbc833032bda6f13925ba235b8d09114.wasm";
    ```
    so that any part of the func file will be able to reference the variable (so that this works with chunks deduplication disabled)
  - adding similar import statements to any chunk files that reference these wasm identifiers, like for example:
    ```js
    // file: .vercel/output/static/_worker.js/__next-on-pages-dist__/chunks/649.js
    import wasm_fbeb8adedbc833032bda6f13925ba235b8d09114 from "../wasm/wasm_fbeb8adedbc833032bda6f13925ba235b8d09114.wasm";
    var a = (b) => {
      b.exports = wasm_fbeb8adedbc833032bda6f13925ba235b8d09114;
    };
    export { a as default };
    ```
    (so that this works with chunks deduplication enabled)

- 3f05e81: update wrangler peer dependency (^2.20.0 -> ^3.0.0)
- 4f43b9b: Fix the issue of refetching the vercel package every single time when using yarn berry.
- 81bfcdb: allow any node built-in module to be statically imported correctly

  currently only static imports from "node:buffer" work correctly, other
  imports, although supported by the workers runtime, aren't handled correctly
  (such as "node:events" and "node:util"), fix this by making sure we handle
  imports from any of the node built-in modules

  > **Note**
  > some node built-in modules supported by the workers runtime still cannot be
  > correctly imported (like "node:path" for example), but this is because they
  > seem to be not allowed by vercel/next itself (so it's something unrelated to
  > next-on-pages)

- 95b1704: Fix non-dynamic trailing slash pages not matching when using `trailingSlash: true`.
- fd51777: remove hacks/workarounds for runtime bugs which are no longer needed
- 97c8739: fix getPackageVersion and use it to discern use of dlx

  fix the `getPackageVersion` function so that it doesn't wrongly produce `N/A` (thus
  improving the `-i|--info` results)

  the when running `vercel build`, use the function to discern if `dlx` should be added
  (for `yarn (berry)` and `pnpm` commands), ensuring that the vercel package is not
  unnecessarily re-fetched/installed

  > **Note**
  > Currently the aforementioned check (and build command) runs `next-on-pages-vercel-cli`
  > anyways that's a temporary solution, the changes here will also apply when we switch
  > back to the proper vercel cli package

## 1.0.0

### Major Changes

- 3e2dad8: use and rely on AsyncLocalStorage

  previously we've been using the node AsyncLocalStorage in a non-breaking way but now we are committing
  to in and using it to store the global env variables as well

  this is a breaking change since moving forward all app running using @cloudflare/next-on-pages must
  have the nodejs_compat compatibility flag set (before not all needed that)

### Minor Changes

- 6fcb58b: make the experimental minification the default behavior and add an option to disabled it

  as part of this:

  - make `--experimental-minify`|`-e` a no-op argument which simply shows a warning which indicates that it is
    a deprecated option (we aren't removing the flag so that we don't break existing build scripts)
  - add a `--disable-worker-minification`|`-m` option to disable the minification of the \_worker.js script (which
    currently coincides with the experimental minification)

- e053756: add nodejs_compat runtime check

  add a runtime check for the presence of the nodejs_compat flag at runtime so that if developers
  forget to use such flag instead of receiving an internal server error they receive an error specifically
  telling them that they have not specified the flag

- 87e183b: New routing system runtime handling and implementation.

  Improves support for advanced routing with Next.js applications on Pages, through leveraging the Vercel build output configuration. The Vercel build output specifies the relevant routing steps that are taken during the lifetime of a request, and this change implements a new system that handles these steps.

- ea761b8: remove disable-chunks-dedup flag
- 86df485: Support for the internationalization (`i18n`) option in `next.config.js`, and locale redirects.
- 4d8a708: utilize Wrangler new capability of dynamically importing code to avoid the evaluation/run of javascript code
  when not necessary, reducing the app's startup time (which causes apps to often hit the script startup CPU time limit)

### Patch Changes

- b3ff89f: Function generation now includes all node modules instead of only node:buffer
- d81c2e3: add pnpm files to ignored list for watch mode

  add the following files to the list of files we ignore for watch mode:

  - `pnpm-lock.yaml`: for consistency since all the other lock files are ignored
  - `.pnpm-store`: to prevent potential infinite loops (https://github.com/cloudflare/next-on-pages/issues/212)
  - `_tmp_*`: to prevent infinite loops, this is needed because pnpm saves/deletes temporary files to get the relative path to its store (https://github.com/pnpm/pnpm/blob/3f85e75dad4f5560a17367e5faad5a387bd47d05/store/store-path/src/index.ts#L41), such files start with `_tmp_` (see: https://github.com/zkochan/packages/blob/f559aef5b63c2477dd72ce156f35d6111af780f6/path-temp/index.js#L6)

- bb23b60: Exit with non-zero status if vercel build fails in non-watch mode
- e2d2046: Fix the prerendered route handling for favicons.
- f1d76cd: Fix the prerendered route handling for generated JSON files.
- 701f0c2: Prevent infinite loops from occuring when checking phases during routing.

## 0.10.1

### Patch Changes

- a680db6: improve the error message shown when the Vercel build fails to make clearer that the issue is not next-on-pages related
- b07e3bc: Fix static route handling in the app directory and copy prerendered routes to the build output static directory.

  If an app directory project builds pages without specifying a runtime and has no server-side functionality, it defaults to generating static pages. These pages are in the form of prerendered routes, which are stored in the build output directory with prerender configs, fallback files, and functions. The functions it creates are not necessary and will be invalid nodejs functions as no runtime was specified, and the fallback files can instead be used as static assets for the pages.

- bddbe04: remove astring dependency

  remove the `astring` dependency and by doing so basically just create and edit
  javascript code via string manipulations.

  this should speed up the experimental minification (since we don't generate js code
  from ASTs anymore) and avoid potential bugs in the `astring` library (like #151)

  note that this is not the cleanest solution and that we should look into implementing
  more robust and stable javascript code handling via AST visiting and manipulations
  (but currently that has proven quite problematic since modern javascript libraries that
  allow such code modding have turned out to be very slow, significantly impacting DX)

- 9f5b83c: fix require-call typo preventing nodeBufferPlugin from properly working

## 0.10.0

### Minor Changes

- 2a159ed: add --info, -i CLI flag to print relevant details about the system and environment

### Patch Changes

- dc74ffe: fix: properly align invalid functions in error message
- e3b92c3: Ignore '.wrangler' directory in watch mode
- cf43f44: move the invalidFunctions check before the no-functions one

  currently if a build contains only invalid functions we'd be presenting a log
  saying that no function was found and simply return the static assets as if
  everything is correct, this is because we check for invalid functions only
  after checking if there are any (valid) ones, this change moves the invalid
  functions check so that is performed first, making sure that the described case
  successfully errors

- 758f588: improve AST checking

  improve the way we check for webpack chunks (for the experimental minification) by
  improving the AST types used and also make the AST checking more robust

## 0.9.0

### Minor Changes

- 3fa5b0e: Add colors to cli logs

### Patch Changes

- 6bb5dea: fix favicon breaking Next.js 13.3.0 app dir applications
- 3fe3a7d: fix small help message typos
- 752ae09: prevent buildSuccess check from crashing with a bad error message.
- 4dfd789: fix `require("node:buffer")` breaking applications

  Next seems to have started relying on `node:buffer` this nodejs module is supported by the workers
  runtime but it fails the \_worker.js build because `node:buffer` isn't recognized by esbuild (since
  we're not bundling for node), simply adding it to the externals option of the build command doesn't
  seem to work since it generates dynamic require calls which fail at runtime.

  So this change also adds an esbuild plugin so that the dynamic require calls to `node:buffer`
  get converted to requires to a new file which statically exports all entries from `node:buffer`,
  effectively removing the problematic require calls whilst allowing the use of `node:buffer` entries.

- 15f7ff5: Show a user-friendly error message for an unknown CLI flag

## 0.8.0

### Minor Changes

- 3387ac9: New routing system build time processing + integration with worker script.

## 0.7.0

### Minor Changes

- 2d72906: Added support to utilize the package manager used in the project for local development
- f58f76f: add prerelease and beta details to cli package version

## 0.6.0

### Minor Changes

- 70b2e80: show the CLI version and also add the --version flag
- 8b4f6d5: allow setting of NODE_ENV

### Patch Changes

- dcbbb9a: Parses cli arguments with the `zodcli` package
- e0c53fe: fix experimental minification always on
- 057baa0: Remove private/telemetry files from the build output.

## 0.5.0

### Minor Changes

- 5e575bf: feat: Add support for current 13.X versions of Next.js

### Patch Changes

- e2c4350: Add support for dynamic route params
- c6c8818: Handle route handler function entries.

## 0.4.2

### Patch Changes

- a937040: fixed npx not working on windows
- bcceaf0: Fix Windows file paths not matching entries in the middleware manifest.
- da15971: Add support for Next.js [basepath](https://nextjs.org/docs/api-reference/next.config.js/basepath)

## 0.4.1

### Patch Changes

- 7bb0c55: Fix fetch requests.
- 72bd20c: add support for middleware in src dir
- b4b4ed0: Fix Webpack minification and toggle esbuild minification.
- 8a14ee3: adjust request so that it contains geo headers

## 0.4.0

### Minor Changes

- 6b8cda7: Avoid invoking worker for static files

### Patch Changes

- 6337b9a: remove redundant vercel install

## 0.3.0

### Minor Changes

- 9ef93ff: Environment variables and bindings are now available on `process.env` from within your SSR'd pages/API handlers!
