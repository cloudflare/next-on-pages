import { BuiltInCacheHandler } from './builtInCacheHandler.js';
import type { CacheHandlerContext } from './incrementalCache.js';

export default class KVCacheHandler extends BuiltInCacheHandler {
	constructor(ctx: CacheHandlerContext) {
		super(ctx);
	}

	public override async retrieve(key: string) {
		const value = await process.env.__NEXT_ON_PAGES__KV_SUSPENSE_CACHE?.get(
			this.buildCacheKey(key),
		);

		return value ?? null;
	}

	public override async update(key: string, value: string) {
		await process.env.__NEXT_ON_PAGES__KV_SUSPENSE_CACHE?.put(
			this.buildCacheKey(key),
			value,
		);
	}
}
