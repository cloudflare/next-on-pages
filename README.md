# ⚡▲ `@cloudflare/next-on-pages` ▲⚡

`@cloudflare/next-on-pages` is a CLI tool that you can use to build and develop [Next.js](https://nextjs.org/) applications so that they can run on the [Cloudflare Pages](https://pages.cloudflare.com/) platform (and integrate with Cloudflare's various other product offerings such as KV, D1, R2 and Durable Objects).

This tool is a best-effort library implemented by the Cloudflare team and the community. As such, most, but not all, Next.js features are supported. See the [Supported Versions and Features document](./docs/supported.md) for more details.

## Quick Start

This section describes how to bundle and deploy a (new or existing) Next.js application and using `@cloudflare/next-on-pages`.

### 1. Create Next App

To start using `@cloudflare/next-on-pages`, you must first have a Next.js project you wish to deploy. If you don't already have a project, you can use the `create-next-app` command:

```sh
npx create-next-app@latest my-next-app
```

<details>

<summary>Note on the Next.js version</summary>

We have confirmed support for to the current version of Next.js, at the time of writing, `13.2.4`. Although we'll endeavor to keep support for newer versions, we cannot guarantee that we'll always be up-to-date with the latest version. If you experience any problems with `@cloudflare/next-on-pages`, you may wish to try pinning to `13.2.4` while we work on supporting any recent breaking changes.

</details>

&NewLine;

Change your current directory to the newly created one:

```sh
cd my-next-app
```

### 2. Configure the application to use the Edge Runtime

In order for your application to run on Cloudflare Pages, it needs to be set to use the Edge Runtime. Make sure that all the files in your application containing server-side code (e.g. any API Routes and any pages which use `getServerSideProps`) export a `config` object specifying the use of the Edge Runtime:

```ts
export const config = {
	runtime: 'edge',
};
```

Additionally, ensure that your application is not using any [unsupported APIs](https://nextjs.org/docs/api-reference/edge-runtime#unsupported-apis) and that its API routes are defined as [Edge API Routes](https://nextjs.org/docs/api-routes/edge-api-routes).

For example, if you've created a Next.js application with `create-next-app` and opted out of both the `src` and `app` directory options, the only file you need to modify is `pages/api/hello.ts`.

### 3. Deploy your application to Cloudflare Pages

You can easily deploy to Cloudflare Pages via the [automatic Git integration](https://developers.cloudflare.com/pages/platform/git-integration/). To do so, start by committing and pushing your application's code to a GitHub/GitLab repository.

Next, in the [Cloudflare Dashboard](https://dash.cloudflare.com/?to=/:account/pages), create a new Pages project:

- Navigate to the project creation pages (_Your account Home_ > _Pages_ > _Create a project_ > _Connect to Git_)
- Select the GitHub/GitLab repository you pushed your code to
- Choose a project name and your production branch
- Select _Next.js_ as the _Framework preset_
- Provide the following options:
  | Option | Value |
  | ---------------------- | ----------------------------------------------------- |
  | Build command | `npx @cloudflare/next-on-pages --experimental-minify` |
  | Build output directory | `.vercel/output/static` |
- In the _Environment variables (advanced)_ section add a new variable named `NODE_VERSION` set to `16` or greater (`18` is not supported yet, See [Build Image Update Discussion](https://github.com/cloudflare/pages-build-image/discussions/1)).
- Click on _Save and Deploy_ to start the deployment (this first deployment won't be fully functional as the next step is also necessary)
- Go to the Pages project settings page (_Settings_ > _Functions_ > _Compatibility Flags_), add the `nodejs_compat` for both the production and preview and make sure that the **Compatibility Date** for both production and preview is set to at least `2022-11-30`.

> If you don't want to set up a Git repository, you can build your `_worker.js` file (as indicated in [Local Development](#local-development)) and publish your application manually via the [wrangler's pages publish command](https://developers.cloudflare.com/workers/wrangler/commands/#publish-1) instead (but you'll still need to set the `nodejs_compat` flag for your project in the Cloudflare dashboard).

## Local development

To locally run the CLI simply run:

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

### Install `@cloudflare/next-on-pages` and vercel (optional)

To speed up local development (especially the refresh speed when running in watch mode) you can optionally choose to install `@cloudflare/next-on-pages` and `vercel` as dev dependencies of your project:

```sh
npm install -D @cloudflare/next-on-pages vercel
```

## Examples

To see some examples on how to use Next.js features with `@cloudflare/next-on-pages` see the [Examples document](./docs/examples.md).

## Contributing

If you want to contribute to this project please refer to the [Contributing document](./docs/contributing.md).

## References

Extra references you might be interested in:

- [Blog post](https://blog.cloudflare.com/next-on-pages)

  The original blog post introducing `@cloudflare/next-on-pages` (24/10/2022), it goes into details on the inspiration for this package and provides some details on how it works.

- [Cloudflare Next.js Guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-nextjs-site/)

  Cloudflare guide on how to create and deploy a Next.js application. The application can be either static (and deployed as simple static assets) or dynamic using the edge runtime (using `@cloudflare/next-on-pages`).
