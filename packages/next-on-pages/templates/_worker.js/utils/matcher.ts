import { applyPCREMatches, matchPCRE } from './pcre';

type HasFieldRequestProperties = {
	url: URL;
	cookies: Record<string, string>;
	headers: Headers;
	routeDest?: string;
};

/**
 * Checks if a Vercel source route's `has` record conditions match a request, and whether the request
 * destination should be updated based on the `has` record.
 *
 * @param has The `has` record conditions to check against the request.
 * @param requestProperties The request properties to check against.
 * @returns Whether the request matches the `has` record conditions, and the new destination if it changed.
 */
export function checkhasField(
	has: VercelHasField,
	{ url, cookies, headers, routeDest }: HasFieldRequestProperties,
): { valid: boolean; newRouteDest?: string } {
	switch (has.type) {
		case 'host': {
			return { valid: url.hostname === has.value };
		}
		case 'header': {
			if (has.value !== undefined) {
				return getHasFieldPCREMatchResult(
					has.value,
					headers.get(has.key),
					routeDest,
				);
			}

			return { valid: headers.has(has.key) };
		}
		case 'cookie': {
			const cookie = cookies[has.key];

			if (cookie && has.value !== undefined) {
				return getHasFieldPCREMatchResult(has.value, cookie, routeDest);
			}

			return { valid: cookie !== undefined };
		}
		case 'query': {
			if (has.value !== undefined) {
				return getHasFieldPCREMatchResult(
					has.value,
					url.searchParams.get(has.key),
					routeDest,
				);
			}

			return { valid: url.searchParams.has(has.key) };
		}
	}
}

/**
 * Gets the has field PCRE match results, and tries to apply any named capture groups to a
 * route destination.
 *
 * @param hasValue The has field value to match against.
 * @param foundValue The value found in the request.
 * @param routeDest Destination to apply match to.
 * @returns Whether the match is valid, and the destination with the match applied.
 */
function getHasFieldPCREMatchResult(
	hasValue: string,
	foundValue: string | null,
	routeDest?: string,
): { valid: boolean; newRouteDest?: string } {
	const { match, captureGroupKeys } = matchPCRE(hasValue, foundValue);

	if (routeDest && match && captureGroupKeys.length) {
		return {
			valid: !!match,
			newRouteDest: applyPCREMatches(routeDest, match, captureGroupKeys, {
				namedOnly: true,
			}),
		};
	}

	return { valid: !!match };
}
