import { CacheAdaptor } from './adaptor.js';

/** Suspense Cache adaptor for the Cache API. */
export default class CacheApiAdaptor extends CacheAdaptor {
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

	public override async update(
		key: string,
		value: string,
		revalidate?: number,
	) {
		const cache = await caches.open(this.cacheName);

		const maxAge = revalidate ?? '31536000'; // 1 year
		const response = new Response(value, {
			headers: new Headers({
				'cache-control': `max-age=${maxAge}`,
			}),
		});
		await cache.put(this.buildCacheKey(key), response);
	}
}
