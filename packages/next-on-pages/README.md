# `@cloudflare/next-on-pages`

`@cloudflare/next-on-pages` is a CLI tool that you can use to build and develop [Next.js](https://nextjs.org/) applications so that they can run on the [Cloudflare Pages](https://pages.cloudflare.com/) platform (and integrate with Cloudflare's various other [product offerings](https://developers.cloudflare.com/pages/platform/functions/bindings/), such as KV, D1, R2, and Durable Objects).

This tool is a best-effort library implemented by the Cloudflare team and the community. As such, most, but not all, Next.js features are supported. See the [Supported Versions and Features document](https://github.com/cloudflare/next-on-pages/blob/main/packages/next-on-pages/docs/supported.md) for more details.

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

For more examples of this and for Next.js versions prior to v13.3.1, take a look at our [examples document](https://github.com/cloudflare/next-on-pages/blob/main/packages/next-on-pages/docs/examples.md). Additionally, ensure that your application is not using any unsupported [APIs](https://nextjs.org/docs/app/api-reference/edge#unsupported-apis) or [features](https://github.com/cloudflare/next-on-pages/blob/main/packages/next-on-pages/docs/supported.md).

### 3. Deploy your application to Cloudflare Pages

To deploy your application to Cloudflare Pages, you need to install the `@cloudflare/next-on-pages` package.

```sh
npm install -D @cloudflare/next-on-pages
```

Then you can deploy to Cloudflare Pages via the [automatic Git integration](https://developers.cloudflare.com/pages/platform/git-integration/). To do so, start by committing and pushing your application's code to a GitHub/GitLab repository.

Next, in the [Cloudflare Dashboard](https://dash.cloudflare.com/?to=/:account/pages), create a new Pages project:

- Navigate to the project creation pages (_Your account Home_ > _Workers & Pages_ > _Create application_ > _Pages_ > _Connect to Git_).
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

> **Note**:
> When deploying via the Git integration, for better compatibility with tools such as `yarn` and `pnpm` we recommend using the Build system version 2 (that is the default so no action is required).

## Recommended development workflow

When developing a `next-on-pages` application, this is the development workflow that Cloudflare recommends:

### Develop using the standard Next.js dev server

The [standard development server provided by Next.js](https://nextjs.org/docs/getting-started/installation#run-the-development-server) is the best available option for a fast and polished development experience. The `next-dev` submodule makes it possible to use Next.js' standard development server while still having access to your Cloudflare bindings.

### Build and preview your application locally

To ensure that your application is being built in a manner that is fully compatible with Cloudflare Pages, before deploying it, or whenever you are comfortable checking the correctness of the application during your development process, you will want to build and preview it locally using Cloudflare's `workerd` JavaScript runtime.

Do this by running:

```sh
npx @cloudflare/next-on-pages
```

And preview your project by running:

```sh
npx wrangler pages dev .vercel/output/static
```

> [!NOTE]
> The [`wrangler pages dev`](/workers/wrangler/commands/#dev-1) command needs to run the application using the [`nodejs_compat`](/workers/configuration/compatibility-dates/#nodejs-compatibility-flag) compatibility flag. The `nodejs_compat` flag can be specified in either your project's `wrangler.toml` file or provided to the command as an inline argument: `--compatibility-flag=nodejs_compat`.

### Deploy your application and iterate

After you have previewed your application locally, you can deploy it to Cloudflare Pages (both via [Direct Uploads](https://developers.cloudflare.com/pages/get-started/direct-upload/) or [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)) and iterate over the process to make new changes.

## Cloudflare Platform Integration

Next.js applications built using `@cloudflare/next-on-pages` get access to resources and information only available or relevant on the Cloudflare platform, such are:

- [Bindings (`env`)](https://developers.cloudflare.com/pages/platform/functions/bindings/), which allows you to take advantage of Cloudflare specific resources.
- [Cloudflare properties (`cf`)](https://developers.cloudflare.com/workers/runtime-apis/request/#incomingrequestcfproperties), object containing information about the request provided by Cloudflare’s global network.
- [Lifecycle methods (`ctx`)](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/#lifecycle-methods), methods to augment or control how the request is handled.

Such can be accessed by calling the `getRequestContext` function in server only code.

For example:

```ts
import { getRequestContext } from '@cloudflare/next-on-pages';

// ...

const { env, cf, ctx } = getRequestContext();
```

> **Warning**: The function cannot be called in code from components using the Pages router.

> **Note**: In order to make the function work in development mode (using the standard Next.js dev server) use the [`@cloudflare/next-on-pages/next-dev`](https://github.com/cloudflare/next-on-pages/tree/main/internal-packages/next-dev) submodule.

> **TypeScript Env Type**: the `env` object returned by `getRequestContext` implements the `CloudflareEnv` interface, add your binding types to such interface in order for get a correctly typed `env` object.

> **Note**: `getRequestContext` throws an error if invoked when the request context is not available, if you prefer to receive `undefined` in such cases use `getOptionalRequestContext` instead, the latter is identical to `getRequestContext` except from the fact that it returns `undefined` when the context is not available.

## Examples

To see some examples on how to use Next.js features with `@cloudflare/next-on-pages`, see the [Examples document](https://github.com/cloudflare/next-on-pages/blob/main/packages/next-on-pages/docs/examples.md).

## Troubleshooting

If you find yourself hitting some issues with `@cloudflare/next-on-pages` please check out our [official troubleshooting documentation](https://developers.cloudflare.com/pages/framework-guides/nextjs/ssr/troubleshooting/).

## More Information

For more information on the project please check out the [README](https://github.com/cloudflare/next-on-pages/blob/main/README.md) in the next-on-pages github repository.
