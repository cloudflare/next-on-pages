# @cloudflare/next-on-pages

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
