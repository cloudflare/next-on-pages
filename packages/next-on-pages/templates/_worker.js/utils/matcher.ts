import { applyPCREMatches, matchPCRE } from './pcre';

type HasFieldRequestProperties = {
	url: URL;
	cookies: Record<string, string>;
	headers: Headers;
	routeDest?: string;
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
	{ url, cookies, headers, routeDest }: HasFieldRequestProperties,
): { valid: boolean; newRouteDest?: string } {
	switch (has.type) {
		case 'host': {
			return { valid: url.hostname === has.value };
		}
		case 'header': {
			if (has.value !== undefined) {
				return { valid: !!matchPCRE(has.value, headers.get(has.key)).match };
			}

			return { valid: headers.has(has.key) };
		}
		case 'cookie': {
			const cookie = cookies[has.key];

			if (cookie && has.value !== undefined) {
				return { valid: !!matchPCRE(has.value, cookie).match };
			}

			return { valid: cookie !== undefined };
		}
		case 'query': {
			if (has.value !== undefined) {
				const { match, captureGroupKeys } = matchPCRE(
					has.value,
					url.searchParams.get(has.key),
				);

				const newRouteDest =
					match && captureGroupKeys.length && routeDest
						? applyPCREMatches(routeDest, match, captureGroupKeys, {
								namedOnly: true,
						  })
						: undefined;

				return { valid: !!match, newRouteDest };
			}

			return { valid: url.searchParams.has(has.key) };
		}
	}
}
