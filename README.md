# `@cloudflare/next-on-pages`

Reference:

- [Blog](https://blog.cloudflare.com/next-on-pages)
- [Documentation](https://developers.cloudflare.com/pages/framework-guides/deploy-a-nextjs-site/)

## Quick Start

1. `npx create-next-app@latest my-app`

1. `cd` into the new directory (e.g. `cd my-app`)

1. `npm install -D @cloudflare/next-on-pages vercel`

1. Configure the project to use the Edge Runtime:

   1. Replace `pages/api/hello.js` with the following:

      ```js
      // Next.js Edge API Routes: https://nextjs.org/docs/api-routes/edge-api-routes

      export const config = {
        runtime: "experimental-edge",
      };

      export default async function (req) {
        return new Response(JSON.stringify({ name: "John Doe" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
      }
      ```

   1. Add the following to `next.config.js`:

      ```diff
      /** @type {import('next').NextConfig} */
      const nextConfig = {
      + experimental: {
      +   runtime: "experimental-edge",
      + },
        reactStrictMode: true,
        swcMinify: true,
      };

      module.exports = nextConfig;
      ```

1. `git commit` and `git push` to a GitHub/GitLab repository.

1. Create a Pages project, connect that repository, and select "Next.js" from the framework preset list.

   | Option                 | Value                                                 |
   | ---------------------- | ----------------------------------------------------- |
   | Build command          | `npx @cloudflare/next-on-pages --experimental-minify` |
   | Build output directory | `.vercel/output/static`                               |

1. Add a `NODE_VERSION` environment variable set to `14` or greater.

1. In the Pages project **Settings** > **Functions** > **Compatibility Flags**, add the `transformstream_enable_standard_constructor` and `streams_enable_constructors` flags. These will not be necessary once they graduate to be on by default on 2022-11-30's compatibility date.

1. The project should now be ready to deploy. Create a new deployment.

## `@cloudflare/next-on-pages` CLI

```
⚡️ @cloudflare/next-to-pages CLI
⚡️
⚡️ Usage: npx @cloudflare/next-to-pages [options]
⚡️
⚡️ Options:
⚡️
⚡️   --help:                Shows this help message
⚡️
⚡️   --skip-build:          Doesn't run 'vercel build' automatically
⚡️
⚡️   --experimental-minify: Attempts to minify the functions of a project (by de-duping webpack chunks)
⚡️
⚡️   --watch:               Automatically rebuilds when the project is edited
⚡️
⚡️
⚡️ GitHub: https://github.com/cloudflare/next-on-pages
⚡️ Docs: https://developers.cloudflare.com/pages/framework-guides/deploy-a-nextjs-site/
```

**Local testing**

In one terminal, run `npx @cloudflare/next-on-pages --watch`, and in another `npx wrangler pages dev .vercel/output/static`. We hope to soon make improvements to the refersh speed.

### Build Output Configuration

| `config.json` property  | Support                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| version                 | `3`                                                                                                                                               |
| routes `src`            | ✅                                                                                                                                                |
| routes `dest`           | 🔄                                                                                                                                                |
| routes `headers`        | 🔄                                                                                                                                                |
| routes `methods`        | ✅                                                                                                                                                |
| routes `continue`       | 🔄                                                                                                                                                |
| routes `caseSensitive`  | ✅                                                                                                                                                |
| routes `check`          | 🔄                                                                                                                                                |
| routes `status`         | 🔄                                                                                                                                                |
| routes `has`            | ✅                                                                                                                                                |
| routes `missing`        | ✅                                                                                                                                                |
| routes `locale`         | 🔄                                                                                                                                                |
| routes `middlewarePath` | ✅                                                                                                                                                |
| images                  | ❌ (see [Cloudflare's Image Resizing documentation](https://developers.cloudflare.com/images/image-resizing/integration-with-frameworks/#nextjs)) |
| wildcard                | 🔄                                                                                                                                                |
| overrides               | 🔄                                                                                                                                                |
| cache                   | ❌                                                                                                                                                |

## Examples

### [Edge API Routes](https://nextjs.org/docs/api-routes/edge-api-routes)

```typescript
// ./pages/api/some_route.ts

import type { NextRequest } from "next/server";

export const config = {
  runtime: "experimental-edge",
};

export default async function handler(req: NextRequest) {
  return new Response(
    JSON.stringify({
      name: process.env.NEXT_RUNTIME,
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    }
  );
}
```

### Server-side rendering (SSR) pages with [`getServerSideProps()`](https://nextjs.org/docs/basic-features/data-fetching/get-server-side-props)

```typescript
// ./pages/ssr.tsx

import type { NextPage } from "next";
import Head from "next/head";
import styles from "../styles/Home.module.css";

export const config = {
  runtime: "experimental-edge",
};

export const getServerSideProps = async () => {
  return {
    props: {
      runtime: process.env.NEXT_RUNTIME,
      uuid: await fetch("https://uuid.rocks/plain").then((response) =>
        response.text()
      ),
    },
  };
};

const Home: NextPage<{ runtime: string; uuid: string }> = ({
  runtime,
  uuid,
}) => {
  return (
    <div className={styles.container}>
      <Head>
        <title>Create Next App</title>
        <meta name="description" content="Generated by create next app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Welcome to{" "}
          <a href="https://nextjs.org">Next.js, running at the {runtime}!</a>
        </h1>

        <p className={styles.description}>
          Get started by editing{" "}
          <code className={styles.code}>pages/index.tsx</code>
        </p>

        <p className={styles.description}>
          Here&apos;s a server-side UUID:
          <code className={styles.code}>{uuid}</code>
        </p>
      </main>
    </div>
  );
};

export default Home;
```

### [Middleware](https://nextjs.org/docs/advanced-features/middleware)

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  return NextResponse.redirect(new URL("/about-2", request.url));
}

export const config = {
  matcher: "/about/:path*",
};
```
