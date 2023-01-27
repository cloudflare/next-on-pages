import { parse } from "cookie";

const hasField = (
	{
		request,
		url,
		cookies,
	}: { request: Request; url: URL; cookies: Record<string, string> },
	has: Source["has"][0]
) => {
	switch (has.type) {
		case "host": {
			// TODO: URL host, hostname or HTTP Header host?
			return url.host === has.value;
		}
		case "header": {
			if (has.value !== undefined) {
				return request.headers.get(has.key)?.match(has.value);
			}

			return request.headers.has(has.key);
		}
		case "cookie": {
			const cookie = cookies[has.key];

			if (has.value !== undefined) {
				return cookie?.match(has.value);
			}

			return cookie !== undefined;
		}
		case "query": {
			if (has.value !== undefined) {
				return url.searchParams.get(has.key)?.match(has.value);
			}

			return url.searchParams.has(has.key);
		}
	}
};

export const routesMatcher = (
	{ request }: { request: Request },
	routes?: Config["routes"]
): Config["routes"] => {
	// https://vercel.com/docs/build-output-api/v3#build-output-configuration/supported-properties/routes
	const url = new URL(request.url);
	const cookies = parse(request.headers.get("cookie") || "");

	const matchingRoutes: Config["routes"] = [];

	for (const route of routes || []) {
		// https://vercel.com/docs/build-output-api/v3#build-output-configuration/supported-properties/routes/source-route
		// TODO: continue, check, locale, middlewarePath

		if ("methods" in route) {
			const requestMethod = request.method.toLowerCase();

			const foundMatch = route.methods.find(
				(method) => method.toLowerCase() === requestMethod
			);

			if (!foundMatch) {
				continue;
			}
		}

		if ("has" in route) {
			const okay = route.has.every((has) =>
				hasField({ request, url, cookies }, has)
			);

			if (!okay) {
				continue;
			}
		}

		if ("missing" in route) {
			const notOkay = route.missing.find((has) =>
				hasField({ request, url, cookies }, has)
			);

			if (notOkay) {
				continue;
			}
		}

		let caseSensitive = false;
		if ("caseSensitive" in route && route.caseSensitive) {
			caseSensitive = true;
		}

		if ("src" in route) {
			const regExp = new RegExp(route.src, caseSensitive ? undefined : "i");
			const match = url.pathname.match(regExp);

			if (match) {
				matchingRoutes.push(route);

				// if (!("continue" in route) || !route.continue) return matchingRoutes;
			}
		} else {
			matchingRoutes.push(route);
			// TODO: route.handle
		}
	}

	return matchingRoutes;
};

type EdgeFunction = {
	default: (
		request: Request,
		context: ExecutionContext
	) => Response | Promise<Response>;
};

type EdgeFunctions = {
	matchers: { regexp: string }[];
	entrypoint: EdgeFunction;
}[];

declare const __CONFIG__: Config;

declare const __FUNCTIONS__: EdgeFunctions;

declare const __MIDDLEWARE__: EdgeFunctions;

export default {
	async fetch(request, env, context) {
    globalThis.process.env = { ...globalThis.process.env, ...env };

    const { pathname } = new URL(request.url);
    const routes = routesMatcher({ request }, __CONFIG__.routes);

    for (const route of routes) {
      if ("middlewarePath" in route && route.middlewarePath in __MIDDLEWARE__) {
        return await __MIDDLEWARE__[route.middlewarePath].entrypoint.default(
          request,
          context
        );
      }
    }

    for (const { matchers, entrypoint } of Object.values(__FUNCTIONS__)) {
      let found = false;
      for (const matcher of matchers) {
        if (matcher.regexp) {
          const regexp = new RegExp(matcher?.regexp);
          if (
            pathname.match(regexp) ||
            `${pathname}/page`.replace("//page", "/page").match(regexp)
          ) {
            found = true;
            break;
          }
        }
      }

      if (found) {
        return entrypoint.default(request, context);
      }
    }

    return env.ASSETS.fetch(request);
  },
} as ExportedHandler<{ ASSETS: Fetcher }>;
