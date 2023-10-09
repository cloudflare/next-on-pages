# Ignoring Invalid Routes

TODO, mention that:

- the build process relying on the vercel tooling can generate invalid serverless functions (and we can't do anything about them)
- you can ignore invalid routes with `--ignoreInvalidRoutes`|`-g`
- you do so at your own risk, when doing such you need to thoroughly check and make sure that ignoring the invalid routes does not break any of your app's functionalities (there is no guarantee, it might or might not, so you need to manually check and make extra sure)
- this should be the last resort to make an application build successfully in case the vercel tooling and/or a used library generates invalid serverless functions, before resorting to this make sure there is no other way to prevent the invalid route from getting generated

---

example:
in app dir a static not-found route plus an edge runtime layout generates a `/_error` invalid route that is something
we can't do anything about at the moment, but the `/_error` route isn't actually necessary in the next-on-pages final application so you can ignore it with:
`     $ npx @cloudflare/next-on-pages --ignore-invalid-routes=/_error
    `
