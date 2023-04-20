# @cloudflare/next-on-pages

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
