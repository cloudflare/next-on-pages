# `next-on-pages/no-pages-nodejs-dynamic-ssg`

When using [`getStaticPaths`](https://nextjs.org/docs/pages/api-reference/functions/get-static-paths) you need to either:

- set a [`false` `fallback`](https://nextjs.org/docs/pages/api-reference/functions/get-static-paths#fallback-false) value
- use the [`edge` runtime](https://nextjs.org/docs/pages/building-your-application/rendering/edge-and-nodejs-runtimes#edge-runtime)

This rule makes sure that if you're using `getStaticPaths` at least one of the two aforementioned conditions is met.

For more details refer to the [official Cloudflare Next.js docs](https://developers.cloudflare.com/pages/framework-guides/nextjs/ssr/troubleshooting/#generatestaticparams).

## ❌ Invalid Code

```js
export async function getStaticPaths() {
	return {
		paths: // ...
        fallback: true
                  ~~~~
	};
}

// ...
```

```js
export async function getStaticPaths() {
	return {
		paths: // ...
        fallback: 'blocking'
                  ~~~~~~~~~~
	};
}

// ...
```

## ✅ Valid Code

```js
export async function getStaticPaths() {
                      ~~~~~~~~~~~~~~
	return {
		paths: // ...
        fallback: false
	};
}

// ...
```

```js
export async function getStaticPaths() {
	return {
		paths: // ...
        fallback: true
	};
}

export const config = {
	runtime: 'experimental-edge',
};

// ...
```

```js
export async function getStaticPaths() {
	return {
		paths: // ...
        fallback: 'blocking'
	};
}

export const runtime = 'experimental-edge';

// ...
```
