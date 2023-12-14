# \_routes.json

Cloudflare Pages supports defining a list of patterns that should (or should not) invoke your worker script. This is useful when using a library like `@cloudflare/next-on-pages` as it allows you to exclude certain static assets, like a favicon, from invoking the routing system on each request, saving you money and improving performance.

To opt-out certain static assets, you can create an `_routes.json` file in your project. This file can specify which assets to include or exclude from invoking the worker script, as per the [Cloudflare docs](https://developers.cloudflare.com/pages/platform/functions/routing/#create-a-_routesjson-file).

For example, to exclude the `/favicon.ico` asset from invoking the worker script, you can create the following `_routes.json` file in the root directory of your project:

```json
{
	"version": 1,
	"exclude": ["/favicon.ico"]
}
```

During the build process, `@cloudflare/next-on-pages` will automatically generate an `_routes.json` file in the output directory. Any entries that are provided in your own `_routes.json` file (in the project's root directory) will be merged with the generated file and take effect when deployed to Cloudflare Pages.

The `_routes.json` file **should only be used for <u>static assets</u>** that do not need to go through the routing system. It **<u>should not</u> be used for routes** as this could lead to unexpected behavior and incorrect routing.
