# Examples

<!-- TODO: improve the following -->

## Edge Runtime

To opt a route into the edge runtime in Next.js, it has to export a `runtime` [route segment config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#runtime) option.

```diff
+ export const runtime = 'edge';
```

<details>
<summary>Prior to Next.js v13.3.1</summary>

When using a Next.js version that is older than v13.3.1, it is possible to export a `config` object from a route and specify a `runtime` option inside that object. This can opt the route into the edge runtime.

```diff
export const config = {
+ runtime: 'edge',
};
```

</details>

<details>
<summary>Prior to Next.js v13.2.4</summary>

When using a Next.js version that is older than v13.2.4, it is possible to specify a `runtime` to use for the entire application. This can be done in the root-level `next.config.js` file, under the `experimental` options.

```diff
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
+   runtime: 'experimental-edge',
  },
  reactStrictMode: true,
  swcMinify: true,
};

module.exports = nextConfig;
```

</details>

### App Directory

#### [Edge Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/router-handlers#edge-and-nodejs-runtimes)

```typescript
// ./app/api/hello/route.ts

import { cookies } from 'next/headers';

export const runtime = 'edge'; // 'nodejs' is the default

export async function GET(request: Request) {
	const cookieStore = cookies();
	const token = cookieStore.get('token');

	return new Response('Hello, Next.js!', {
		status: 200,
		headers: { 'Set-Cookie': `token=${token}` },
	});
}
```

#### [Server Side Rendering](https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic-rendering#dynamic-rendering)

```typescript
// ./app/ssr/page.tsx

export const runtime = 'edge';

export default async function Page({ searchParams }: { searchParams: any }) {
	return (
		<div className="prose prose-sm prose-invert max-w-none">
			<h1 className="text-lg font-bold">
				Updating <code>searchParams</code>
			</h1>
			<p>
				<code>searchParams</code> is <code>{JSON.stringify(searchParams)}</code>
			</p>
		</div>
	);
}
```

### Pages Directory

#### [Edge API Routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes#edge-api-routes)

```typescript
// ./pages/api/some_route.ts

import type { NextRequest } from 'next/server';

export const config = {
	runtime: 'edge',
};

export default async function handler(req: NextRequest) {
	return new Response(
		JSON.stringify({
			name: process.env.NEXT_RUNTIME,
		}),
		{
			status: 200,
			headers: {
				'content-type': 'application/json',
			},
		}
	);
}
```

#### Server-side rendering (SSR) pages with [`getServerSideProps()`](https://nextjs.org/docs/pages/building-your-application/data-fetching/get-server-side-props)

```typescript
// ./pages/ssr.tsx

import styles from '../styles/Home.module.css';

export const config = {
	runtime: 'edge',
};

export const getServerSideProps = async () => {
	return {
		props: {
			runtime: process.env.NEXT_RUNTIME,
			uuid: await fetch('https://uuid.rocks/plain').then(response =>
				response.text()
			),
		},
	};
};

type Props = { runtime: string; uuid: string };

export default function Page({ runtime, uuid }: Props) {
	return (
		<div className={styles.container}>
			<main className={styles.main}>
				<h1 className={styles.title}>
					Welcome to{' '}
					<a href="https://nextjs.org">Next.js, running at the {runtime}!</a>
				</h1>

				<p className={styles.description}>
					Here&apos;s a server-side UUID:
					<code className={styles.code}>{uuid}</code>
				</p>
			</main>
		</div>
	);
}
```

## [Middleware](https://nextjs.org/docs/pages/building-your-application/routing/middleware)

```typescript
// ./middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
	return NextResponse.redirect(new URL('/home', request.url));
}

export const config = {
	matcher: '/about/:path*',
};
```
