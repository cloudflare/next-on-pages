// pcre-to-regexp converts a PCRE string to a regular expression. It also extracts the named
// capture group keys, which is useful for matching and replacing parameters.
// This is the same library used by Vercel in the build output, and is used here to ensure
// consistency and proper support.
import createPCRE from 'pcre-to-regexp/dist/index.js';

export type MatchPCREResult = {
	match: RegExpMatchArray | null;
	captureGroupKeys: string[];
};

/**
 * Checks if a value matches with a PCRE-compatible string, and extract the capture group keys.
 *
 * @param expr PCRE-compatible string.
 * @param val String to check with the regular expression.
 * @param caseSensitive Whether the regular expression should be case sensitive.
 * @returns The result of the matcher and the named capture group keys.
 */
export function matchPCRE(
	expr: string,
	val: string,
	caseSensitive?: boolean
): MatchPCREResult {
	const flag = caseSensitive ? '' : 'i';
	const captureGroupKeys: string[] = [];

	const matcher = createPCRE(`%${expr}%${flag}`, captureGroupKeys);
	const match = matcher.exec(val);

	return { match, captureGroupKeys };
}

/**
 * Processes the value and replaced any matched parameters (index or named capture groups).
 *
 * @param rawStr String to process.
 * @param match Matches from the PCRE matcher.
 * @param captureGroupKeys Named capture group keys from the PCRE matcher.
 * @returns The processed string with replaced parameters.
 */
export function applyPCREMatches(
	rawStr: string,
	match: RegExpMatchArray,
	captureGroupKeys: string[]
): string {
	return rawStr.replace(/\$([a-zA-Z0-9]+)/g, (_, key) => {
		const index = captureGroupKeys.indexOf(key);
		// If the extracted key does not exist as a named capture group from the matcher, we can
		// reasonably assume it's a number and return the matched index. Fallback to an empty string.
		return (index === -1 ? match[parseInt(key, 10)] : match[index + 1]) || '';
	});
}
