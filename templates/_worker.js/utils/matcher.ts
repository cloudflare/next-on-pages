// NOTE: Will be refined in the new routing system. (see issue #129)
export const hasField = (
	{
		request,
		url,
		cookies,
	}: { request: Request; url: URL; cookies: Record<string, string> },
	has: NonNullable<VercelSource['has']>[0]
) => {
	switch (has.type) {
		case 'host': {
			// TODO: URL host, hostname or HTTP Header host?
			return url.host === has.value;
		}
		case 'header': {
			if (has.value !== undefined) {
				return request.headers.get(has.key)?.match(has.value);
			}

			return request.headers.has(has.key);
		}
		case 'cookie': {
			const cookie = cookies[has.key];

			if (has.value !== undefined) {
				return cookie?.match(has.value);
			}

			return cookie !== undefined;
		}
		case 'query': {
			if (has.value !== undefined) {
				return url.searchParams.get(has.key)?.match(has.value);
			}

			return url.searchParams.has(has.key);
		}
		default: {
			return false;
		}
	}
};
