<p align="center">
  <h1 align="center">⚡▲ <code>@cloudflare/next-on-pages</code> ▲⚡</h1>

  <p align="center">Build, develop, and deploy Next.js apps for Cloudflare Pages.</p>
</p>

`@cloudflare/next-on-pages` is a CLI tool that you can use to build and develop [Next.js](https://nextjs.org/) applications so that they can run on the [Cloudflare Pages](https://pages.cloudflare.com/) platform.

Alongside the `@cloudflare/next-on-pages` there is an additional package `eslint-plugin-next-on-pages` implementing an Eslint plugin which aim is to aid developers at using the `@cloudflare/next-on-pages` more efficiently and improve their overall developer experience when working with it.

You can see the packages contents (with their documentation) in their respective package directories:

- [`@cloudflare/next-on-pages`](https://github.com/cloudflare/next-on-pages/tree/main/packages/next-on-pages#cloudflarenext-on-pages)
- [`eslint-plugin-next-on-pages`](https://github.com/cloudflare/next-on-pages/tree/main/packages/eslint-plugin-next-on-pages#eslint-plugin-next-on-pages)

Additionally there is also the `next-dev` submodule which is implemented as a separate package in this repository but included as a submodule of the main `@cloudflare/next-on-pages` package, you can see the submodule's content here:

- [`@cloudflare/next-on-pages/next-dev`](https://github.com/cloudflare/next-on-pages/tree/main/internal-packages/next-dev)

## Contributing

If you want to contribute to this project (both to the main package and the eslint one) please refer to the [Contributing document](./docs/contributing.md).

## References

Extra references you might be interested in:

- [Blog post](https://blog.cloudflare.com/next-on-pages)

  The original blog post introducing `@cloudflare/next-on-pages` (24/10/2022), it goes into details on the inspiration for this package and provides some details on how it works.

- [Cloudflare Next.js Guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-nextjs-site/)

  Cloudflare guide on how to create and deploy a Next.js application. The application can be either static (and deployed as simple static assets) or dynamic using the edge runtime (using `@cloudflare/next-on-pages`).

- [Technical Documentation](./docs/technical)

  Explanations and insights into how `@cloudflare/next-on-pages` works, design decisions behind different aspects, and how it handles different Next.js features.
