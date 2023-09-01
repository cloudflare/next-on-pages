import type { MatchPCREResult } from './pcre';
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
				const match = matchPCRE(has.value, headers.get(has.key));
				return {
					valid: !!match.match,
					newRouteDest: tryApplyMatch(routeDest, match),
				};
			}

			return { valid: headers.has(has.key) };
		}
		case 'cookie': {
			const cookie = cookies[has.key];

			if (cookie && has.value !== undefined) {
				const match = matchPCRE(has.value, cookie);
				return {
					valid: !!match.match,
					newRouteDest: tryApplyMatch(routeDest, match),
				};
			}

			return { valid: cookie !== undefined };
		}
		case 'query': {
			if (has.value !== undefined) {
				const match = matchPCRE(has.value, url.searchParams.get(has.key));
				return {
					valid: !!match.match,
					newRouteDest: tryApplyMatch(routeDest, match),
				};
			}

			return { valid: url.searchParams.has(has.key) };
		}
	}
}

/**
 * Try to apply a PCRE match's named capture groups to a destination.
 *
 * @param dest Destination to apply match to.
 * @param match Matched PCRE result.
 * @returns The destination with the match applied, or `undefined` if there was no match.
 */
function tryApplyMatch(
	dest: string | undefined,
	{ match, captureGroupKeys }: MatchPCREResult,
): string | undefined {
	if (dest && match && captureGroupKeys.length) {
		return applyPCREMatches(dest, match, captureGroupKeys, { namedOnly: true });
	}

	return undefined;
}
