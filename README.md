<p align="center">
  <h1 align="center">⚡▲ <code>@cloudflare/next-on-pages</code> ▲⚡</h1>

  <p align="center">Build, develop, and deploy Next.js apps for Cloudflare Pages.</p>
</p>

`@cloudflare/next-on-pages` is a CLI tool that you can use to build and develop [Next.js](https://nextjs.org/) applications so that they can run on the [Cloudflare Pages](https://pages.cloudflare.com/) platform (and integrate with Cloudflare's various other [product offerings](https://developers.cloudflare.com/pages/platform/functions/bindings/), such as KV, D1, R2, and Durable Objects).

This tool is a best-effort library implemented by the Cloudflare team and the community. As such, most, but not all, Next.js features are supported. See the [Supported Versions and Features document](./docs/supported.md) for more details.

## Quick Start

This section describes how to bundle and deploy a (new or existing) Next.js application to [Cloudflare Pages](https://pages.cloudflare.com), using `@cloudflare/next-on-pages`.

### 1. Select your Next.js app

To start using `@cloudflare/next-on-pages`, you must have a Next.js project that you wish to deploy. If you already have one, change to its directory. Otherwise, you can use the `create-next-app` command to start a new one.

```sh
npx create-next-app@latest my-next-app
cd my-next-app
```

<details>
<summary>Note on the Next.js version</summary>

We have confirmed support for the current version of Next.js at the time of writing, `13.4.2`. Although we'll endeavor to keep support for newer versions, we cannot guarantee that we'll always be up-to-date with the latest version. If you experience any problems with `@cloudflare/next-on-pages`, you may wish to try pinning to `13.4.2` while we work on supporting any recent breaking changes.

</details>

### 2. Configure the application to use the Edge Runtime

For your application to run on Cloudflare Pages, it needs to opt in to use the Edge Runtime for routes containing server-side code (e.g. API Routes or pages that use `getServerSideProps`). To do this, export a `runtime` [route segment config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#runtime) option from each file, specifying that it should use the Edge Runtime.

```typescript
export const runtime = 'edge';
```

&NewLine;

For more examples of this and for Next.js versions prior to v13.3.1, take a look at our [examples document](/docs/examples.md). Additionally, ensure that your application is not using any [unsupported APIs](https://nextjs.org/docs/app/api-reference/edge#unsupported-apis) or [features](./docs/supported.md).

### 3. Deploy your application to Cloudflare Pages

To deploy your application to Cloudflare Pages, you need to install the `@cloudflare/next-on-pages` package.

```sh
npm install -D @cloudflare/next-on-pages
```

Then you can deploy to Cloudflare Pages via the [automatic Git integration](https://developers.cloudflare.com/pages/platform/git-integration/). To do so, start by committing and pushing your application's code to a GitHub/GitLab repository.

Next, in the [Cloudflare Dashboard](https://dash.cloudflare.com/?to=/:account/pages), create a new Pages project:

- Navigate to the project creation pages (_Your account Home_ > _Pages_ > _Create a project_ > _Connect to Git_).
- Select the GitHub/GitLab repository you pushed your code to.
- Choose a project name and your production branch.
- Select _Next.js_ as the _Framework preset_ and provide the following options:
  | Option | Value |
  | ---------------------- | ---------------------------------- |
  | Build command | `npx @cloudflare/next-on-pages@1` |
  | Build output directory | `.vercel/output/static` |
- In the _Environment variables (advanced)_ section, add a new variable named `NODE_VERSION` set to `16` or greater.
- Click on _Save and Deploy_ to start the deployment (this first deployment won't be fully functional as the next step is also necessary).
- Go to the Pages project settings page (_Settings_ > _Functions_ > _Compatibility Flags_), **add the `nodejs_compat` flag** for both production and preview, and make sure that the **Compatibility Date** for both production and preview is set to at least `2022-11-30`.

> If you don't want to set up a Git repository, you can build your application (as indicated in [Local Development](#local-development)) and publish it manually via the [`wrangler pages publish` command](https://developers.cloudflare.com/workers/wrangler/commands/#publish-1) instead (you'll still need to set the **`nodejs_compat`** flag for your project in the Cloudflare dashboard).

## Local development

To run the CLI locally, simply run:

```sh
npx @cloudflare/next-on-pages
```

This command will build your Next.js application and produce a `.vercel/output/static` directory which you can then use with Wrangler:

```sh
npx wrangler pages dev .vercel/output/static --compatibility-flag=nodejs_compat
```

Running `npx @cloudflare/next-on-pages --help` will display a useful help message which will detail the various additional options the CLI offers.

### Local development in watch mode

If you want to work on your Next.js application while using `@cloudflare/next-on-pages`, run the CLI in watch mode with:

```sh
npx @cloudflare/next-on-pages --watch
```

Then in a separate terminal run:

```sh
npx wrangler pages dev .vercel/output/static --compatibility-flag=nodejs_compat
```

## Examples

To see some examples on how to use Next.js features with `@cloudflare/next-on-pages`, see the [Examples document](./docs/examples.md).

## Contributing

If you want to contribute to this project please refer to the [Contributing document](./docs/contributing.md).

## References

Extra references you might be interested in:

- [Blog post](https://blog.cloudflare.com/next-on-pages)

  The original blog post introducing `@cloudflare/next-on-pages` (24/10/2022), it goes into details on the inspiration for this package and provides some details on how it works.

- [Cloudflare Next.js Guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-nextjs-site/)

  Cloudflare guide on how to create and deploy a Next.js application. The application can be either static (and deployed as simple static assets) or dynamic using the edge runtime (using `@cloudflare/next-on-pages`).

- [Technical Documentation](./docs/technical)

  Explanations and insights into how `@cloudflare/next-on-pages` works, design decisions behind different aspects, and how it handles different Next.js features.
