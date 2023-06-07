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
