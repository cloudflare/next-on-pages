import { parse } from 'cookie';
import { adjustRequestForVercel, hasField } from './utils';

// NOTE: Will be replaced in the new routing system. (see issue #129)
export const routesMatcher = (
	{ request }: { request: Request },
	routes?: VercelConfig['routes']
): NonNullable<VercelConfig['routes']> => {
	// https://vercel.com/docs/build-output-api/v3#build-output-configuration/supported-properties/routes
	const url = new URL(request.url);
	const cookies = parse(request.headers.get('cookie') || '');

	const matchingRoutes: VercelConfig['routes'] = [];

	for (const route of routes || []) {
		// https://vercel.com/docs/build-output-api/v3#build-output-configuration/supported-properties/routes/source-route
		// TODO: continue, check, locale, middlewarePath

		if ('methods' in route) {
			const requestMethod = request.method.toLowerCase();

			const foundMatch = route.methods?.find(
				method => method.toLowerCase() === requestMethod
			);

			if (!foundMatch) {
				continue;
			}
		}

		if ('has' in route) {
			const okay = route.has?.every(has =>
				hasField({ request, url, cookies }, has)
			);

			if (!okay) {
				continue;
			}
		}

		if ('missing' in route) {
			const notOkay = route.missing?.find(has =>
				hasField({ request, url, cookies }, has)
			);

			if (notOkay) {
				continue;
			}
		}

		let caseSensitive = false;
		if ('caseSensitive' in route && route.caseSensitive) {
			caseSensitive = true;
		}

		if ('src' in route && route.src) {
			const regExp = new RegExp(route.src, caseSensitive ? undefined : 'i');
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

declare const __CONFIG__: ProcessedVercelConfig;

declare const __BUILD_OUTPUT__: VercelBuildOutput;

// NOTE: Will be removed in the new routing system. (see issue #129)
declare const __BASE_PATH__: string;

export default {
	async fetch(request, env, context) {
		globalThis.process.env = { ...globalThis.process.env, ...env };

		const { pathname } = new URL(request.url);
		// NOTE: Will be removed in the new routing system. (see issue #129)
		// middleware only occur in the `none` routing phase (i.e. before all other phases).
		const routes = routesMatcher({ request }, __CONFIG__.routes.none);

		// NOTE: Will be removed in the new routing system. (see issue #129)
		for (const route of routes) {
			if (
				'middlewarePath' in route &&
				route.middlewarePath &&
				route.middlewarePath in __BUILD_OUTPUT__
			) {
				const item = __BUILD_OUTPUT__[route.middlewarePath];

				if (item?.type === 'middleware') {
					return await (await item.entrypoint).default(request, context);
				}
			}
		}

		// NOTE: Will be replaced in the new routing system. (see issue #129)
		// Filtering for type `function` is temporary while the new routing system is being implemented.
		for (const { matchers, entrypoint } of Object.values(
			__BUILD_OUTPUT__
		).filter(
			item => item.type === 'function'
		) as AdjustedBuildOutputFunction[]) {
			let found = false;
			for (const matcher of matchers) {
				if (matcher.regexp) {
					const regexp = new RegExp(matcher?.regexp);
					const nextJsPathname = pathname.startsWith(__BASE_PATH__)
						? // Remove basePath from URL, also squish `//` into `/`
						  // If the baseUrl is set to "/docs" the following will happen:
						  // `/docs/profile/settings` -> `/profile/settings`
						  // `/docs` -> `/`
						  // `/docs/` -> `/`
						  // `/docs/_next/static/main.js` -> `/_next/static/main.js`
						  pathname.replace(__BASE_PATH__, '/').replace('//', '/')
						: pathname;

					const nextJsPathnameMatcher = nextJsPathname.match(regexp);

					if (
						nextJsPathnameMatcher ||
						`${nextJsPathname}/page`.replace('//page', '/page').match(regexp)
					) {
						if (nextJsPathnameMatcher?.groups) {
							const params = Object.entries(nextJsPathnameMatcher.groups);
							const urlWithParams = new URL(request.url);
							for (const [key, value] of params) {
								urlWithParams.searchParams.set(key, value);
							}
							request = new Request(urlWithParams.toString(), request);
						}

						found = true;
						break;
					}
				}
			}

			if (found) {
				const adjustedRequest = adjustRequestForVercel(request);
				return (await entrypoint).default(adjustedRequest, context);
			}
		}

		return env.ASSETS.fetch(request);
	},
} as ExportedHandler<{ ASSETS: Fetcher }>;
