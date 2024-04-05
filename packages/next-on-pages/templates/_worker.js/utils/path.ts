/**
 * Given a path that represents a multi-segment dynamic path, such as it normalizes such path so that
 * it doesn't include the path as a single query parameter but as multiple ones.
 *
 * If a path doesn't represent a multi-segment dynamic path then the path is returned untouched.
 *
 * (Note: this shouldn't generally be necessary, but we've observer that during routes rewrites
 *  non "normalized" paths could generate errors and break applications, so we always normalize them).
 *
 * @param path Multi-segment dynamic path to process.
 * @returns The normalize version of the path (or the original path if no normalization is needed).
 */
export function normalizeMultiSegmentsPath(path: string): string {
	const match = path.match(
		/^(\/?\[?\[\.\.\.(.*?)\]\]?)\?(?:(?:nxtP)?\2)=(.*\/.*)$/,
	);

	if (!match?.length) {
		return path;
	}

	const [, prefix, queryParam, matchPath] = match;

	const params = new URLSearchParams();
	const segments = matchPath?.split('/') ?? [];
	segments.forEach(segment => params.append(queryParam ?? '', segment));

	return `${prefix}?${params}`;
}
