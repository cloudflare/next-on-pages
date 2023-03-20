# ⚡▲ next-on-pages ▲⚡

next-on-pages is a CLI tool that you can use to build and develop [Next.js](https://nextjs.org/) applications so that they can run on the [Cloudflare Pages](https://pages.cloudflare.com/) platform (and integrate with the various Cloudflare offerings such as KV stores, and Durable Objects).

This tool is a best-effort library implemented by the Cloudflare team and the community since Vercel doesn't and likely won't support Next.js running on Cloudflare officially. As such most but not all Next.js features are yet supported, see the [Supported Versions and Features document](./docs/supported.md) for more details.

## Quick Start

This section describes how to bundle and deploy a (new or existing) Next.js application and using next-on-pages.

> Note: this readme uses `npm`, but nothing relies on it, you can instead use `yarn` or `pnpm` if you want.

### 1. Create Next App

To start creating a Next.js application using next-on-pages, start by creating a standard Next.js application using the create-next-app command (skip this step if you already have an existing Next.js application that you want to port to Cloudflare using next-on-pages):

```sh
npx create-next-app@13.2.4 my-next-app
```

<details>

<summary>Note on the Next.js version</summary>

The above command suggests to use Next's `13.2.4` version, that is the latest at the time of writing, older versions are also supported (but they might be only partially), newer versions might not be so be wary of that. The team will soon test various versions and document more clearly which are supported to what degree.

</details>

&NewLine;

Change your current directory to the newly created one, as the following step require you to be in it:

```sh
cd my-next-app
```

### 2. Configure the application to use the Edge Runtime

In order for the application to run on Cloudflare Pages it needs to be set to run on the edge runtime, in order to do so make sure that all the files in your application containing server side code (as your api routes and pages using `getServerSideProps`) export a config object specifying the use of the edge runtime:

```ts
export const config = {
	runtime: 'edge',
};
```

Make also sure that your application is not using [unsupported APIs](https://nextjs.org/docs/api-reference/edge-runtime#unsupported-apis) and its API routes are defined as [Edge API Routes](https://nextjs.org/docs/api-routes/edge-api-routes).

For example if you've created a Next.js application and opted out of both the `src` and `app` directory options, the only file you need to modify is the `pages/api/hello.ts` one.

### 3. Deploy your application to Cloudflare Pages

You can easily deploy to Cloudflare Pages via the [automatic git integration](https://developers.cloudflare.com/pages/platform/git-integration/), to do so, start by committing and pushing your application's code to a Github/GitLab repository.

Next in the [Cloudflare Dashboard](dash.cloudflare.com) to create a new Pages project:

- Navigate to the project creation pages (_Your account Home_ > _Pages_ > _Create a project_ > _Connect to Git_)
- Select the Github/GitLab repository you pushed your code to
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

> If you don't want to set up a git repository, you can build your `_worker.js` file (as indicated in [Local Development](#local-development)) and publish your application manually via the [wrangler's pages publish command](https://developers.cloudflare.com/workers/wrangler/commands/#publish-1) instead (but you'll still need to set the `NODE_VERSION` environment variable and the `nodejs_compat` flag for your project in the Cloudflare dashboard).

## Local development

To locally run the CLI simply run:

```sh
npx @cloudflare/next-on-pages
```

This command will build your Next.js application and bundle a `_worker.js` file for you to use.

If you provide the `--help` flag a useful help message will be displayed showing you the various options the CLI offers.

### Local development in watch mode

If you want to work on your Next.js application while using next-on-pages, run the CLI in watch mode via:

```sh
npx @cloudflare/next-on-pages --watch
```

Then in a separate terminal run:

```sh
npx wrangler pages dev .vercel/output/static --compatibility-flag=nodejs_compat
```

to view the application and having it refresh when you make changes to your code.

### Install next-on-pages and vercel (optional)

To speed up local development (especially the refresh speed in watch mode) you can install next-on-pages and `vercel` as dev dependencies of your project, note that this is optional and if you decide to install only one of them or neither everything will still run correctly anyways:

```sh
npm install -D @cloudflare/next-on-pages vercel
```

## Examples

To see some examples on how to use Next.js features with next-on-pages see the [Examples document](./docs/examples.md).

## Contributing

If you want to contribute to the project please refer to the [Contributing document](./docs/contributing.md).

## References

Extra references you might be interested in:

- [Blog post](https://blog.cloudflare.com/next-on-pages)

  The original blog post introducing next-on-pages (24/10/2022), it goes into details on how the package came to be and provides details on how it works.

- [Cloudflare Next.js Guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-nextjs-site/)

  Cloudflare guide on how to create and deploy a Next.js application. The application can be either static (and deployed as simple static assets) or dynamic using the edge runtime (via next-on-pages).
