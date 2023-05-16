# @cloudflare/next-on-pages

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
