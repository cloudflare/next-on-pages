import type { CacheInterface } from './cache-interface';
import {
	SUSPENSE_CACHE_URL,
	getSuspenseCacheInterface,
} from './cache-interface';

/**
 * Handles an internal request to the suspense cache.
 *
 * @param request Incoming request to handle.
 * @returns Response to the request, or null if the request is not for the suspense cache.
 */
export async function handleSuspenseCacheRequest(
	request: Request,
	revalidatedTags: Set<string>,
) {
	const baseUrl = `https://${SUSPENSE_CACHE_URL}/v1/suspense-cache/`;
	if (!request.url.startsWith(baseUrl)) return null;

	try {
		const url = new URL(request.url);
		const cache = await getSuspenseCacheInterface();

		if (url.pathname === '/v1/suspense-cache/revalidate') {
			// Update the revalidated timestamp for the tags in the tags manifest.
			const tags = url.searchParams.get('tags')?.split(',') ?? [];
			await cache.setTags(tags, { revalidatedAt: Date.now() });

			tags.forEach(tag => revalidatedTags.add(tag));

			return new Response(null, { status: 200 });
		}

		// Extract the cache key from the URL.
		const cacheKey = url.pathname.replace('/v1/suspense-cache/', '');
		if (!cacheKey.length) {
			return new Response('Invalid cache key', { status: 400 });
		}

		switch (request.method) {
			case 'GET':
				// Retrieve the value from the cache.
				return handleRetrieveEntry(cache, cacheKey, { revalidatedTags });
			case 'POST':
				// Update the value in the cache.
				return handleUpdateEntry(cache, cacheKey, {
					body: await request.text(),
					revalidatedTags,
				});
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
 * Retrieves a value from the suspense cache.
 *
 * @param cache Interface for the suspense cache.
 * @param cacheKey Key of the cached value to retrieve.
 * @returns Response with the cached value.
 */
async function handleRetrieveEntry(
	cache: CacheInterface,
	cacheKey: string,
	{ revalidatedTags }: { revalidatedTags: Set<string> },
) {
	// Get entry from the cache.
	const entry = await cache.get(cacheKey);
	if (!entry) return new Response(null, { status: 404 });

	let data: CacheEntry;
	try {
		data = JSON.parse(entry) as CacheEntry;
	} catch (e) {
		return new Response('Failed to parse cache entry', { status: 400 });
	}

	// Load the tags manifest.
	await cache.loadTagsManifest();

	// Check if the cache entry is stale or fresh based on the tags.
	const tags = getDerivedTags(data.value.data.tags ?? []);
	const isStale = tags.some(tag => {
		const tagEntry = cache.tagsManifest?.items?.[tag];
		return (
			tagEntry?.revalidatedAt && tagEntry?.revalidatedAt >= data.lastModified
		);
	});

	const cacheAge =
		(Date.now() - data.lastModified) / 1000 +
		// If the cache entry is stale, add the revalidate interval to properly force a revalidation.
		(isStale ? data.value.revalidate : 0);

	if (isStale && tags.some(tag => revalidatedTags.has(tag))) {
		return new Response('Forced revalidation for server actions', {
			status: 404,
		});
	}

	// Return the value from the cache.
	return new Response(JSON.stringify(data.value), {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
			'x-vercel-cache-state': 'fresh',
			age: `${cacheAge}`,
		},
	});
}

/**
 * Updates an entry in the suspense cache.
 *
 * @param cache Interface for the suspense cache.
 * @param cacheKey Key of the cached value to update.
 * @param body Body of the request to update the cache entry with.
 * @returns Response indicating the success of the operation.
 */
async function handleUpdateEntry(
	cache: CacheInterface,
	cacheKey: string,
	{ body, revalidatedTags }: { body: string; revalidatedTags: Set<string> },
) {
	const newEntry: CacheEntry = {
		lastModified: Date.now(),
		value: JSON.parse(body),
	};

	// Update the cache entry.
	await cache.put(cacheKey, JSON.stringify(newEntry), {
		headers: new Headers({
			'cache-control': `max-age=${newEntry.value.revalidate}`,
		}),
	});

	// Update the tags with the cache key.
	const tags = newEntry.value.data.tags ?? [];
	await cache.setTags(tags, { cacheKey });

	getDerivedTags(tags).forEach(tag => revalidatedTags.delete(tag));

	return new Response(null, { status: 200 });
}

type CacheEntry = { lastModified: number; value: NextCachedFetchValue };

// https://github.com/vercel/next.js/blob/fda1ecc/packages/next/src/server/response-cache/types.ts#L16
type NextCachedFetchValue = {
	kind: 'FETCH';
	data: {
		headers: { [k: string]: string };
		body: string;
		url: string;
		status?: number;
		tags?: string[];
	};
	revalidate: number;
};

/**
 * Derives a list of tags from the given tags. This is taken from the Next.js source code.
 *
 * @see https://github.com/vercel/next.js/blob/1286e145/packages/next/src/server/lib/incremental-cache/utils.ts
 *
 * @param tags Array of tags.
 * @returns Derived tags.
 */
function getDerivedTags(tags: string[]): string[] {
	const derivedTags: string[] = ['/'];

	for (const tag of tags || []) {
		if (tag.startsWith('/')) {
			const pathnameParts = tag.split('/');

			// we automatically add the current path segments as tags
			// for revalidatePath handling
			for (let i = 1; i < pathnameParts.length + 1; i++) {
				const curPathname = pathnameParts.slice(0, i).join('/');

				if (curPathname) {
					derivedTags.push(curPathname);

					if (!derivedTags.includes(curPathname)) {
						derivedTags.push(curPathname);
					}
				}
			}
		} else if (!derivedTags.includes(tag)) {
			derivedTags.push(tag);
		}
	}
	return derivedTags;
}
