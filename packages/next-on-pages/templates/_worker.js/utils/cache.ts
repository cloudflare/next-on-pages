import { SUSPENSE_CACHE_URL } from '../../cache';
import {
	IncrementalCache,
	type CacheHandler,
	type IncrementalCacheValue,
} from '../../cache/incrementalCache';

// https://github.com/vercel/next.js/blob/48a566bc/packages/next/src/server/lib/incremental-cache/fetch-cache.ts#L19
const CACHE_TAGS_HEADER = 'x-vercel-cache-tags';
// https://github.com/vercel/next.js/blob/ba23d986/packages/next/src/lib/constants.ts#L18
const NEXT_CACHE_SOFT_TAGS_HEADER = 'x-next-cache-soft-tags';

// https://github.com/vercel/next.js/blob/fc25fcef/packages/next/src/server/lib/incremental-cache/fetch-cache.ts#L21
const CACHE_STATE_HEADER = 'x-vercel-cache-state';

/**
 * Handles an internal request to the suspense cache.
 *
 * @param request Incoming request to handle.
 * @param buildMetadata Metadata collected during the build process.
 * @returns Response to the request, or null if the request is not for the suspense cache.
 */
export async function handleSuspenseCacheRequest(
	request: Request,
	buildMetadata: NextOnPagesBuildMetadata,
) {
	const baseUrl = `https://${SUSPENSE_CACHE_URL}/v1/suspense-cache/`;
	if (!request.url.startsWith(baseUrl)) return null;

	try {
		const url = new URL(request.url);
		const incrementalCache = await getIncrementalCache(request, buildMetadata);

		if (url.pathname === '/v1/suspense-cache/revalidate') {
			// Update the revalidated timestamp for the tags in the tags manifest.
			const tags = url.searchParams.get('tags')?.split(',') ?? [];

			for (const tag of tags) {
				await incrementalCache.revalidateTag(tag);
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
				const softTags = getTagsFromHeader(
					request,
					NEXT_CACHE_SOFT_TAGS_HEADER,
				);

				const data = await incrementalCache.get(cacheKey, { softTags });
				if (!data) return new Response(null, { status: 404 });

				return new Response(JSON.stringify(data.value), {
					status: 200,
					headers: {
						'Content-Type': 'application/json',
						[CACHE_STATE_HEADER]: 'fresh',
						age: `${data.age}`,
					},
				});
			}
			case 'POST': {
				// Update the value in the cache.
				const body = await request.json<IncrementalCacheValue>();
				// Falling back to the cache tags header for Next.js 13.5+
				if (body.data.tags === undefined) {
					body.tags ??= getTagsFromHeader(request, CACHE_TAGS_HEADER) ?? [];
				}

				await incrementalCache.set(cacheKey, body, { tags: body.tags });

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
 * Gets an IncrementalCache instance to be used to implement the suspense caching.
 *
 * @param request Incoming request to handle.
 * @param buildMetadata Metadata collected during the build process.
 * @returns An IncrementalCache instance
 */
export async function getIncrementalCache(
	request: Request,
	buildMetadata: NextOnPagesBuildMetadata,
): Promise<IncrementalCache> {
	let curCacheHandler: typeof CacheHandler | undefined = undefined;
	try {
		const customAdaptorFileName = 'custom.js';
		curCacheHandler = (
			await import(`./__next-on-pages-dist__/cache/${customAdaptorFileName}`)
		).default;
	} catch (e) {
		/**/
	}

	if (!curCacheHandler) {
		if (process.env.__NEXT_ON_PAGES__KV_SUSPENSE_CACHE) {
			curCacheHandler = await getBuiltInCacheHandler('kv');
		} else {
			curCacheHandler = await getBuiltInCacheHandler('workers-cache-api');
		}
	}

	const requestHeaders = Object.fromEntries(request.headers.entries());

	const { allowedRevalidateHeaderKeys, fetchCacheKeyPrefix } =
		buildMetadata.config?.experimental ?? {};

	return new IncrementalCache({
		curCacheHandler,
		allowedRevalidateHeaderKeys,
		requestHeaders,
		fetchCacheKeyPrefix,
	});
}

async function getBuiltInCacheHandler(
	type: 'kv' | 'workers-cache-api',
): Promise<typeof CacheHandler> {
	const fileName = {
		kv: 'KVCacheHandler',
		'workers-cache-api': 'workersCacheApiCacheHandler',
	}[type];
	const cacheHandlerModule = await import(
		`./__next-on-pages-dist__/cache/${fileName}.js`
	);
	return cacheHandlerModule.default;
}

function getTagsFromHeader(req: Request, key: string): string[] | undefined {
	return req.headers.get(key)?.split(',')?.filter(Boolean);
}
