import type { CacheAdaptor, IncrementalCacheValue } from '../../cache';
import { SUSPENSE_CACHE_URL } from '../../cache';

// https://github.com/vercel/next.js/blob/48a566bc/packages/next/src/server/lib/incremental-cache/fetch-cache.ts#L19
const CACHE_TAGS_HEADER = 'x-vercel-cache-tags';
// https://github.com/vercel/next.js/blob/ba23d986/packages/next/src/lib/constants.ts#L18
const NEXT_CACHE_SOFT_TAGS_HEADER = 'x-next-cache-soft-tags';

const REQUEST_CONTEXT_KEY = Symbol.for('__cloudflare-request-context__');

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
				const softTags = getTagsFromHeader(
					request,
					NEXT_CACHE_SOFT_TAGS_HEADER,
				);

				// Retrieve the value from the cache.
				const data = await cache.get(cacheKey, { softTags });
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
				// Retrieve request context.
				const reqCtx = (globalThis as unknown as Record<symbol, unknown>)[
					REQUEST_CONTEXT_KEY
				] as { ctx: ExecutionContext };

				const update = async () => {
					// Update the value in the cache.
					const body = await request.json<IncrementalCacheValue>();
					// Falling back to the cache tags header for Next.js 13.5+
					if (body.data.tags === undefined) {
						body.tags ??= getTagsFromHeader(request, CACHE_TAGS_HEADER) ?? [];
					}

					await cache.set(cacheKey, body);
				};

				if (reqCtx) {
					// Avoid waiting for the cache to update before responding, if possible.
					reqCtx.ctx.waitUntil(update());
				} else {
					await update();
				}

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
	if (process.env.__NEXT_ON_PAGES__KV_SUSPENSE_CACHE) {
		return getInternalCacheAdaptor('kv');
	}

	return getInternalCacheAdaptor('cache-api');
}

/**
 * Gets an internal cache adaptor.
 *
 * @param type The type of adaptor to get.
 * @returns A new instance of the adaptor.
 */
async function getInternalCacheAdaptor(
	type: 'kv' | 'cache-api',
): Promise<CacheAdaptor> {
	const adaptor = await import(`./__next-on-pages-dist__/cache/${type}.js`);
	return new adaptor.default();
}

function getTagsFromHeader(req: Request, key: string): string[] | undefined {
	return req.headers.get(key)?.split(',')?.filter(Boolean);
}
