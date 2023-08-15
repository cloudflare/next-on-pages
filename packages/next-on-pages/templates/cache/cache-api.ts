import type { IncrementalCacheValue } from './interface';
import { CacheInterface, SUSPENSE_CACHE_URL } from './interface';
import { withMemoryInterfaceInDev } from './memory';

/** Suspense Cache interface for the Cache API. */
export class CacheApiInterface extends CacheInterface {
	constructor(ctx: Record<string, unknown> = {}) {
		super(ctx);
	}

	public override async retrieve(key: string) {
		const cache = await caches.open('suspense-cache');

		const response = await cache.match(this.buildCacheKey(key));
		return response ? response.text() : null;
	}

	public override async update(key: string, value: string) {
		const cache = await caches.open('suspense-cache');

		// Figure out the max-age for the cache entry.
		const entry = JSON.parse(value) as IncrementalCacheValue;
		const maxAge =
			key === this.tagsManifestKey || entry.kind !== 'FETCH'
				? '31536000'
				: entry.revalidate;

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

export default withMemoryInterfaceInDev;
