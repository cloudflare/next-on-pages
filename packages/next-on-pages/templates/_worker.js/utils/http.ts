import type { MatchPCREResult } from './pcre';
import { applyPCREMatches } from './pcre';

/**
 * Applies a set of headers to a response.
 *
 * If the header key is `set-cookie`, the value will be appended. Otherwise, the value will be set
 * and overridden to prevent duplicates which sometimes happens with headers like `x-matched-path`.
 *
 * @param target Headers object to apply to.
 * @param source Headers to apply.
 * @param pcreMatch PCRE match result to apply to header values.
 */
export function applyHeaders(
	target: Headers,
	source: Record<string, string> | Headers,
	pcreMatch?: MatchPCREResult,
): void {
	const entries =
		source instanceof Headers ? source.entries() : Object.entries(source);
	for (const [key, value] of entries) {
		const lowerKey = key.toLowerCase();
		const newValue = pcreMatch?.match
			? applyPCREMatches(value, pcreMatch.match, pcreMatch.captureGroupKeys)
			: value;

		if (lowerKey === 'set-cookie') {
			target.append(lowerKey, newValue);
		} else {
			target.set(lowerKey, newValue);
		}
	}
}

/**
 * Checks if a string is an URL.
 *
 * @param url String to check.
 * @returns Whether the string is an URL.
 */
export function isUrl(url: string): boolean {
	return /^https?:\/\//.test(url);
}

/**
 * Merges search params from one URLSearchParams object to another.
 *
 * Only appends the parameter if the target does not contain it, or if the value is different and not undefined.
 *
 * For params prefixed with `nxtP`, it also sets the param without the prefix if it does not exist.
 * The `nxtP` prefix indicates that it is for Next.js dynamic route parameters. In some cases,
 * Next.js fails to derive the correct route parameters and so we need to set them manually.
 * https://github.com/vercel/next.js/blob/canary/packages/next/src/lib/constants.ts#L3
 *
 * @param target Target that search params will be applied to.
 * @param source Source search params to apply to the target.
 */
export function applySearchParams(
	target: URLSearchParams,
	source: URLSearchParams,
) {
	for (const [key, value] of source.entries()) {
		const paramMatch = /^nxtP(.+)$/.exec(key);
		if (paramMatch?.[1]) {
			target.set(key, value);
			target.set(paramMatch[1], value);
		} else if (
			!target.has(key) ||
			(!!value && !target.getAll(key).includes(value))
		) {
			target.append(key, value);
		}
	}
}

/**
 * Creates a new Request object with the same body, headers, and search params as the original.
 *
 * Replaces the URL with the given path, stripping the `.html` extension and `/index.html` for
 * asset matching.
 * https://developers.cloudflare.com/pages/platform/serving-pages/#route-matching
 *
 * @param req Request object to re-create.
 * @param path URL to use for the new Request object.
 * @returns A new Request object with the same body and headers as the original.
 */
export function createRouteRequest(req: Request, path: string) {
	const newUrl = new URL(path, req.url);
	applySearchParams(newUrl.searchParams, new URL(req.url).searchParams);

	newUrl.pathname = newUrl.pathname
		.replace(/^\/index.html$/, '/')
		.replace(/\.html$/, '');

	return new Request(newUrl, req);
}

/**
 * Creates a new Response object with the same body and headers as the original.
 *
 * Useful when the response object may be immutable.
 *
 * @param resp Response object to re-create.
 * @returns A new Response object with the same body and headers.
 */
export function createMutableResponse(resp: Response) {
	return new Response(resp.body, resp);
}

/**
 * Parses the Accept-Language header value and returns an array of locales sorted by quality.
 *
 * @param headerValue Accept-Language header value.
 * @returns Array of locales sorted by quality.
 */
export function parseAcceptLanguage(headerValue: string): string[] {
	return headerValue
		.split(',')
		.map(val => {
			const [lang, qual] = val.split(';') as [string, string | undefined];
			const quality = parseFloat((qual ?? 'q=1').replace(/q *= */gi, ''));

			return [lang.trim(), isNaN(quality) ? 1 : quality] as [string, number];
		})
		.sort((a, b) => b[1] - a[1])
		.map(([locale]) => (locale === '*' || locale === '' ? [] : locale))
		.flat();
}
