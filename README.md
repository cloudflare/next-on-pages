# `@cloudflare/next-on-pages`

Reference:

- [Blog](https://blog.cloudflare.com/next-on-pages)
- [Documentation](https://developers.cloudflare.com/pages/framework-guides/deploy-a-nextjs-site/)

## Quick Start

1. `npx create-next-app@latest my-app`

   Note that if you select to use eslint, there are a couple of places you need to add return types to make the default template pass the pre-build checks.

   If you using yarn, run `yarn create next-app@latest my-app`

   If you using pnpm, run `pnpm create next-app@latest my-app`

1. `cd` into the new directory (e.g. `cd my-app`)

1. Configure the project to use the Edge Runtime:

   1. Replace `pages/api/hello.ts` with the following:

      ```typescript
      // Next.js Edge API Routes: https://nextjs.org/docs/api-routes/edge-api-routes
      import type { NextRequest } from "next/server";

      export const config = {
        runtime: "experimental-edge",
      };

      export default async function handler(
        req: NextRequest
      ): Promise<Response> {
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

   <br><br>
   For npm:

   | Option                 | Value                                                 |
   | ---------------------- | ----------------------------------------------------- |
   | Build command          | `npx @cloudflare/next-on-pages --experimental-minify` |
   | Build output directory | `.vercel/output/static`                               |

   <br><br>
   For yarn v3 (berry):

   | Option                 | Value                                                      |
   | ---------------------- | ---------------------------------------------------------- |
   | Build command          | `yarn dlx @cloudflare/next-on-pages --experimental-minify` |
   | Build output directory | `.vercel/output/static`                                    |

   <br><br>
   For yarn v1 (classic):

   Since yarn v1 doesn't support download and execute (dlx in yarn v3, npx in npm and pnpx in pnpm),

   You need to first add a script to your package.json (in this example, we will add `build:cf`)

   ```json
   {
      ...
      "scripts": {
         "build": "next build",
         "build:cf": "next-on-pages --experimental-minify"
      }
      ...
   }
   ```

   then install this package by running `yarn add @cloudflare/next-on-pages -D`

   and use the following settings in your pages project

   | Option                 | Value                   |
   | ---------------------- | ----------------------- |
   | Build command          | `yarn build:cf`         |
   | Build output directory | `.vercel/output/static` |

   <br><br>
   For pnpm:

   | Option                 | Value                                                                                       |
   | ---------------------- | ------------------------------------------------------------------------------------------- |
   | Build command          | `npm i -g pnpm && pnpm install && pnpx dlx @cloudflare/next-on-pages --experimental-minify` |
   | Build output directory | `.vercel/output/static`                                                                     |

   <br>

1. Add a `NODE_VERSION` environment variable set to `14` or greater.

   Note that if you are using Next.js v13 you need to set to `16`

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

In one terminal, run `npx @cloudflare/next-on-pages --watch`, and in another `npx wrangler pages dev .vercel/output/static --compatibility-flags=streams_enable_constructors`. We hope to soon make improvements to the refresh speed.

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

- ✅: Supported
- 🔄: Not currently supported, but it's probably possible and we may add support in the future
- ❌: Not supported and unlikely we ever will support this

## Examples

### [Next.js 13's `app` Directory](https://beta.nextjs.org/docs/routing/fundamentals#the-app-directory)

Add the following to `next.config.js`:

```diff
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    runtime: "experimental-edge",
+   appDir: true,
  },
  reactStrictMode: true,
  swcMinify: true,
};

module.exports = nextConfig;
```

If you're following the [Next.js 12 → 13 Upgrade Guide](https://beta.nextjs.org/docs/upgrade-guide#step-4-migrating-pages), delete any `./pages/_app.tsx` and `./pages/index.tsx` files and replace with `./app/layout.tsx` and `./app/page.tsx`:

```typescript
// ./app/layout.tsx
import "../styles/globals.css";
import { FC } from "react";

const RootLayout: FC<{
  children: React.ReactNode;
}> = ({
  // Layouts must accept a children prop.
  // This will be populated with nested layouts or pages
  children,
}) => {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
};

export default RootLayout;
```

```typescript
// ./app/page.tsx
import { FC } from "react";
import styles from "../styles/Home.module.css";

const Home = async (): Promise<ReturnType<FC>> => {
  const uuid = await fetch("https://uuid.rocks/plain").then(
    async (response) => await response.text()
  );

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>
          Welcome to <a href="https://nextjs.org">Next.js!</a>
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
