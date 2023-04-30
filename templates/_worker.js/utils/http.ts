import type { MatchPCREResult } from './pcre';
import { applyPCREMatches } from './pcre';

/**
 * Applies a set of headers to a response.
 *
 * @param source Headers to apply.
 * @param target Headers object to apply to.
 * @param pcreMatch PCRE match result to apply to header values.
 */
export function applyHeaders(
	source: Record<string, string> | Headers,
	target: Headers,
	pcreMatch?: MatchPCREResult
): void {
	const entries =
		source instanceof Headers ? source.entries() : Object.entries(source);
	for (const [key, value] of entries) {
		target.set(
			key.toLowerCase(),
			pcreMatch?.match
				? applyPCREMatches(value, pcreMatch.match, pcreMatch.captureGroupKeys)
				: value
		);
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
 * @param source Source search params to apply to the target.
 * @param target Target that search params will be applied to.
 */
export function applySearchParams(
	source: URLSearchParams,
	target: URLSearchParams
) {
	for (const [key, value] of source.entries()) {
		target.set(key, value);
	}
}

/**
 * Creates a new Request object with the same body and headers as the original.
 *
 * Replaces the URL with the given path, stripping the `.html` extension and `/index.html` for
 * asset matching.
 * https://developers.cloudflare.com/pages/platform/serving-pages/#route-matching
 *
 * @param req Request object to re-create.
 * @param path URL to use for the new Request object.
 * @returns A new Request object with the same body and headers as the original.
 */
export function createNewRequest(req: Request, path: string) {
	const newUrl = new URL(path, req.url);
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
export function createNewResponse(resp: Response) {
	return new Response(resp.body, resp);
}
