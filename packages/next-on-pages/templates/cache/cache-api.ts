import { CacheAdaptor, SUSPENSE_CACHE_URL } from './adaptor';

/** Suspense Cache adaptor for the Cache API. */
export class CacheApiAdaptor extends CacheAdaptor {
	/** Name of the cache to open in the Cache API. */
	public cacheName = 'suspense-cache';

	constructor(ctx: Record<string, unknown> = {}) {
		super(ctx);
	}

	public override async retrieve(key: string) {
		const cache = await caches.open(this.cacheName);

		const response = await cache.match(this.buildCacheKey(key));
		return response ? response.text() : null;
	}

	public override async update(key: string, value: string) {
		const cache = await caches.open(this.cacheName);

		// The max-age to use for the cache entry.
		const maxAge = '31536000'; // 1 year

		const response = new Response(value, {
			headers: new Headers({
				'cache-control': `max-age=${maxAge}`,
			}),
		});
		await cache.put(this.buildCacheKey(key), response);
	}

	/**
	 * Builds the full cache key for the suspense cache.
	 *
	 * @param key Key for the item in the suspense cache.
	 * @returns The fully-formed cache key for the suspense cache.
	 */
	public buildCacheKey(key: string) {
		return `https://${SUSPENSE_CACHE_URL}/entry/${key}`;
	}
}
