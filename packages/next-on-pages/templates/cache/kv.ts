import { CacheAdaptor } from './adaptor';

/** Suspense Cache adaptor for Workers KV. */
export default class KVAdaptor extends CacheAdaptor {
	constructor(ctx: Record<string, unknown> = {}) {
		super(ctx);
	}

	public override async retrieve(key: string) {
		const value = await process.env.KV_SUSPENSE_CACHE?.get(
			this.buildCacheKey(key),
		);

		return value ?? null;
	}

	public override async update(key: string, value: string) {
		await process.env.KV_SUSPENSE_CACHE?.put(this.buildCacheKey(key), value);
	}
}
