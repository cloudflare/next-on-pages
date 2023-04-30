import type { MatchPCREResult } from './pcre';
import { matchPCRE } from './pcre';

type HasFieldRequestProperties = {
	url: URL;
	cookies: Record<string, string>;
	headers: Headers;
};

/**
 * Checks if a Vercel source route's `has` record conditions match a request.
 *
 * @param has The `has` record conditions to check against the request.
 * @param requestProperties The request properties to check against.
 * @returns Whether the request matches the `has` record conditions.
 */
export function hasField(
	has: VercelHasField,
	{ url, cookies, headers }: HasFieldRequestProperties
): boolean {
	switch (has.type) {
		case 'host': {
			return url.hostname === has.value;
		}
		case 'header': {
			if (has.value !== undefined) {
				return !!headers.get(has.key)?.match(has.value);
			}

			return headers.has(has.key);
		}
		case 'cookie': {
			const cookie = cookies[has.key];

			if (has.value !== undefined) {
				return !!cookie?.match(has.value);
			}

			return cookie !== undefined;
		}
		case 'query': {
			if (has.value !== undefined) {
				return !!url.searchParams.get(has.key)?.match(has.value);
			}

			return url.searchParams.has(has.key);
		}
	}
}

type CheckRouteMatchRequestProperties = {
	url: URL;
	cookies: Record<string, string>;
	headers: Headers;
	method: string;
	requiredStatus?: number;
};

/**
 * Checks if a Vercel source route from the build output config matches a request.
 *
 * @param route Build output config source route object.
 * @param currentPath Current path to check against.
 * @param requestProperties Request properties to check against.
 * @returns The source path match result if the route matches, otherwise `undefined`.
 */
export function checkRouteMatch(
	route: VercelSource,
	currentPath: string,
	{
		url,
		cookies,
		headers,
		method,
		requiredStatus,
	}: CheckRouteMatchRequestProperties
): MatchPCREResult | undefined {
	const srcMatch = matchPCRE(route.src, currentPath, route.caseSensitive);
	if (!srcMatch.match) return;

	// One of the HTTP `methods` conditions must be met - skip if not met.
	if (
		route.methods &&
		!route.methods.map(m => m.toUpperCase()).includes(method.toUpperCase())
	) {
		return;
	}

	// All `has` conditions must be met - skip if one is not met.
	if (route.has?.find(has => !hasField(has, { url, cookies, headers }))) {
		return;
	}

	// All `missing` conditions must not be met - skip if one is met.
	if (route.missing?.find(has => hasField(has, { url, cookies, headers }))) {
		return;
	}

	// Required status code must match (i.e. for error routes) - skip if not met.
	if (requiredStatus && route.status !== requiredStatus) {
		return;
	}

	return srcMatch;
}
