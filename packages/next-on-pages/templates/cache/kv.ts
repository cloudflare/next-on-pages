import { CacheAdaptor } from './adaptor.js';

/** Suspense Cache adaptor for Workers KV. */
export default class KVAdaptor extends CacheAdaptor {
	constructor(ctx: Record<string, unknown> = {}) {
		super(ctx);
	}

	public override async retrieve(key: string) {
		const value = await process.env.__NEXT_ON_PAGES__KV_SUSPENSE_CACHE?.get(
			this.buildCacheKey(key),
		);

		return value ?? null;
	}

	public override async update(
		key: string,
		value: string,
		revalidate?: number,
	) {
		const expiry = revalidate
			? {
					expirationTtl: revalidate,
			  }
			: {};

		await process.env.__NEXT_ON_PAGES__KV_SUSPENSE_CACHE?.put(
			this.buildCacheKey(key),
			value,
			expiry,
		);
	}
}
