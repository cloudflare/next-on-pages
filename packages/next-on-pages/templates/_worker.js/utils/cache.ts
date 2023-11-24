import type { CacheAdaptor, IncrementalCacheValue } from '../../cache';
import { SUSPENSE_CACHE_URL } from '../../cache';
import { CacheApiAdaptor } from '../../cache/cache-api';

// https://github.com/vercel/next.js/blob/48a566bc/packages/next/src/server/lib/incremental-cache/fetch-cache.ts#L19
const CACHE_TAGS_HEADER = 'x-vercel-cache-tags';

/**
 * Handles an internal request to the suspense cache.
 *
 * @param request Incoming request to handle.
 * @returns Response to the request, or null if the request is not for the suspense cache.
 */
export async function handleSuspenseCacheRequest(request: Request) {
	const baseUrl = `https://${SUSPENSE_CACHE_URL}/v1/suspense-cache/`;
	if (!request.url.startsWith(baseUrl)) return null;

	try {
		const url = new URL(request.url);
		const cache = await getSuspenseCacheAdaptor();

		if (url.pathname === '/v1/suspense-cache/revalidate') {
			// Update the revalidated timestamp for the tags in the tags manifest.
			const tags = url.searchParams.get('tags')?.split(',') ?? [];

			for (const tag of tags) {
				await cache.revalidateTag(tag);
			}

			return new Response(null, { status: 200 });
		}

		// Extract the cache key from the URL.
		const cacheKey = url.pathname.replace('/v1/suspense-cache/', '');
		if (!cacheKey.length) {
			return new Response('Invalid cache key', { status: 400 });
		}

		switch (request.method) {
			case 'GET': {
				// Retrieve the value from the cache.
				const data = await cache.get(cacheKey);
				if (!data) return new Response(null, { status: 404 });

				return new Response(JSON.stringify(data.value), {
					status: 200,
					headers: {
						'Content-Type': 'application/json',
						'x-vercel-cache-state': 'fresh',
						age: `${(Date.now() - (data.lastModified ?? Date.now())) / 1000}`,
					},
				});
			}
			case 'POST': {
				// Update the value in the cache.
				const body = await request.json<IncrementalCacheValue>();
				// Falling back to the cache tags header for Next.js 13.5+
				body.tags = body.tags ?? body.data.tags ?? request.headers.get(CACHE_TAGS_HEADER)?.split(',') ?? [];

				await cache.set(cacheKey, body);

				return new Response(null, { status: 200 });
			}
			default:
				return new Response(null, { status: 405 });
		}
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error(e);
		return new Response('Error handling cache request', { status: 500 });
	}
}

/**
 * Gets the cache adaptor to use for the suspense cache.
 *
 * @returns Adaptor for the suspense cache.
 */
export async function getSuspenseCacheAdaptor(): Promise<CacheAdaptor> {
	// TODO: Try to lazy import the custom cache adaptor.
	return new CacheApiAdaptor();
}
