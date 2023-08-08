export const SUSPENSE_CACHE_URL = 'INTERNAL_SUSPENSE_CACHE_HOSTNAME';

/**
 * Gets the cache interface to use for the suspense cache.
 *
 * Prioritises KV > D1 > R2 > Cache API.
 *
 * @returns Interface for the suspense cache.
 */
export async function getSuspenseCacheInterface(): Promise<CacheInterface> {
	if (process.env.KV_SUSPENSE_CACHE) {
		return new KVCacheInterface(process.env.KV_SUSPENSE_CACHE);
	}

	if (process.env.D1_SUSPENSE_CACHE) {
		return new D1CacheInterface(process.env.D1_SUSPENSE_CACHE);
	}

	if (process.env.R2_SUSPENSE_CACHE) {
		return new R2CacheInterface(process.env.R2_SUSPENSE_CACHE);
	}

	const cacheApi = await caches.open('suspense-cache');
	return new CacheApiInterface(cacheApi);
}

type Caches = Cache | KVNamespace | D1Database | R2Bucket;

/** Generic interface for the Suspense Cache. */
export class CacheInterface<T = Caches> {
	public tagsManifest: TagsManifest | undefined;
	public tagsManifestKey = 'tags-manifest';

	constructor(protected cache: T) {}

	/**
	 * Puts a new entry in the suspense cache.
	 *
	 * @param key Key for the item in the suspense cache.
	 * @param value The cached value to add to the suspense cache.
	 * @param init Options for the cache entry.
	 */
	public async put(
		key: string,
		value: string,
		init?: RequestInit,
	): Promise<void> {
		throw new Error(`Method not implemented, ${key} - ${value} - ${init}`);
	}

	/**
	 * Retrieves an entry from the suspense cache.
	 *
	 * @param key Key for the item in the suspense cache.
	 * @returns The cached value, or null if no entry exists.
	 */
	public async get(key: string): Promise<string | null> {
		throw new Error(`Method not implemented, ${key}`);
	}

	/**
	 * Deletes an entry from the suspense cache.
	 *
	 * @param key Key for the item in the suspense cache.
	 */
	public async delete(key: string): Promise<void> {
		throw new Error(`Method not implemented, ${key}`);
	}

	/**
	 * Loads the tags manifest from the suspense cache.
	 */
	public async loadTagsManifest(): Promise<void> {
		try {
			const rawManifest = await this.get(this.tagsManifestKey);
			if (rawManifest) {
				this.tagsManifest = JSON.parse(rawManifest) as TagsManifest;
			}
		} catch (e) {
			// noop
		}

		if (!this.tagsManifest) {
			this.tagsManifest = { version: 1, items: {} } satisfies TagsManifest;
		}
	}

	/**
	 * Saves the local tags manifest in the suspence cache.
	 */
	public async saveTagsManifest(): Promise<void> {
		if (this.tagsManifest) {
			await this.put(this.tagsManifestKey, JSON.stringify(this.tagsManifest), {
				headers: new Headers({ 'Cache-Control': 'max-age=31536000' }),
			});
		}
	}

	/**
	 * Sets the tags for an item in the suspense cache's tags manifest.
	 *
	 * @param tags Tags for the key.
	 * @param setTagsInfo Key for the item in the suspense cache, or the new revalidated at timestamp.
	 */
	public async setTags(
		tags: string[],
		{ cacheKey, revalidatedAt }: { cacheKey?: string; revalidatedAt?: number },
	): Promise<void> {
		await this.loadTagsManifest();

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const tagsManifest = this.tagsManifest!;

		for (const tag of tags) {
			const data = tagsManifest.items[tag] ?? { keys: [] };

			if (cacheKey && !data.keys.includes(cacheKey)) {
				data.keys.push(cacheKey);
			}

			if (revalidatedAt) {
				data.revalidatedAt = revalidatedAt;
			}

			tagsManifest.items[tag] = data;
		}

		await this.saveTagsManifest();
	}
}

/** Suspense Cache interface for the Cache API. */
class CacheApiInterface extends CacheInterface<Cache> {
	constructor(cache: Cache) {
		super(cache);
	}

	public override async put(key: string, value: string, init?: RequestInit) {
		const response = new Response(value, init);
		await this.cache.put(this.buildCacheKey(key), response);
	}

	public override async get(key: string) {
		const response = await this.cache.match(this.buildCacheKey(key));
		return response ? response.text() : null;
	}

	public override async delete(key: string) {
		await this.cache.delete(this.buildCacheKey(key));
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

/** Suspense Cache interface for Workers KV. */
class KVCacheInterface extends CacheInterface<KVNamespace> {
	constructor(cache: KVNamespace) {
		super(cache);
	}

	public override async put(key: string, value: string) {
		await this.cache.put(key, value);
	}

	public override async get(key: string) {
		return this.cache.get(key);
	}

	public override async delete(key: string) {
		await this.cache.delete(key);
	}
}

/**
 * Suspense Cache interface for D1.
 *
 * **Table Creation SQL**
 * ```sql
 * CREATE TABLE IF NOT EXISTS suspense_cache (key text PRIMARY KEY, value text NOT NULL);
 * ```
 */
class D1CacheInterface extends CacheInterface<D1Database> {
	constructor(cache: D1Database) {
		super(cache);
	}

	public override async put(key: string, value: string) {
		const status = await this.cache
			.prepare(
				`INSERT OR REPLACE INTO suspense_cache (key, value) VALUES (?, ?)`,
			)
			.bind(key, value)
			.run();
		if (status.error) throw new Error(status.error);
	}

	public override async get(key: string) {
		const value = await this.cache
			.prepare(`SELECT value FROM suspense_cache WHERE key = ?`)
			.bind(key)
			.first('value');
		return typeof value === 'string' ? value : null;
	}

	public override async delete(key: string) {
		await this.cache
			.prepare(`DELETE FROM suspense_cache WHERE key = ?`)
			.bind(key)
			.run();
	}
}

/** Suspense Cache interface for R2. */
class R2CacheInterface extends CacheInterface<R2Bucket> {
	constructor(cache: R2Bucket) {
		super(cache);
	}

	public override async put(key: string, value: string) {
		await this.cache.put(key, value);
	}

	public override async get(key: string) {
		const value = await this.cache.get(key);
		return value ? value.text() : null;
	}

	public override async delete(key: string) {
		await this.cache.delete(key);
	}
}

// TODO: DO Interface

type TagsManifest = {
	version: 1;
	items: { [tag: string]: TagsManifestItem };
};

type TagsManifestItem = { keys: string[]; revalidatedAt?: number };
