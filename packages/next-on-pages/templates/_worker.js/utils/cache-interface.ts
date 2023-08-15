export const SUSPENSE_CACHE_URL = 'INTERNAL_SUSPENSE_CACHE_HOSTNAME';

/**
 * Gets the cache interface to use for the suspense cache.
 *
 * @returns Interface for the suspense cache.
 */
export async function getSuspenseCacheInterface(): Promise<CacheInterface> {
	// TODO: import lazy loaded cache interface.

	return new CacheApiInterface({});
}

const revalidatedTags = new Set<string>();

/** Generic interface for the Suspense Cache. */
export class CacheInterface {
	public tagsManifest: TagsManifest | undefined;
	public tagsManifestKey = 'tags-manifest';

	constructor(protected options: unknown) {}

	/**
	 * Retrieves an entry from the storage mechanism.
	 *
	 * @param key Key for the item.
	 * @returns The value, or null if no entry exists.
	 */
	public async retrieve(key: string): Promise<string | null> {
		throw new Error(`Method not implemented - ${key}`);
	}

	/**
	 * Updates an entry in the storage mechanism.
	 *
	 * @param key Key for the item.
	 * @param value The value to update.
	 */
	public async update(key: string, value: string): Promise<void> {
		throw new Error(`Method not implemented - ${key}, ${value}`);
	}

	/**
	 * Puts a new entry in the suspense cache.
	 *
	 * @param key Key for the item in the suspense cache.
	 * @param value The cached value to add to the suspense cache.
	 */
	public async set(key: string, value: IncrementalCacheValue): Promise<void> {
		const newEntry: CacheHandlerValue = {
			lastModified: Date.now(),
			value,
		};

		// Update the cache entry.
		await this.update(key, JSON.stringify(newEntry));

		switch (newEntry.value?.kind) {
			case 'FETCH': {
				// Update the tags with the cache key.
				const tags = newEntry.value.data.tags ?? [];
				await this.setTags(tags, { cacheKey: key });

				getDerivedTags(tags).forEach(tag => revalidatedTags.delete(tag));
			}
		}
	}

	/**
	 * Retrieves an entry from the suspense cache.
	 *
	 * @param key Key for the item in the suspense cache.
	 * @returns The cached value, or null if no entry exists.
	 */
	public async get(key: string): Promise<CacheHandlerValue | null> {
		// Get entry from the cache.
		const entry = await this.retrieve(key);
		if (!entry) return null;

		let data: CacheHandlerValue;
		try {
			data = JSON.parse(entry) as CacheHandlerValue;
		} catch (e) {
			// return new Response('Failed to parse cache entry', { status: 400 });
			// TODO: Debug message
			return null;
		}

		switch (data.value?.kind) {
			case 'FETCH': {
				// Load the tags manifest.
				await this.loadTagsManifest();

				// Check if the cache entry is stale or fresh based on the tags.
				const tags = getDerivedTags(data.value.data.tags ?? []);
				const isStale = tags.some(tag => {
					// If a revalidation has been triggered, the current entry is stale.
					if (revalidatedTags.has(tag)) return true;

					const tagEntry = this.tagsManifest?.items?.[tag];
					return (
						tagEntry?.revalidatedAt &&
						tagEntry?.revalidatedAt >= (data.lastModified ?? Date.now())
					);
				});

				// Don't return stale data from the cache.
				return isStale ? null : data;
			}
			default: {
				return data;
			}
		}
	}

	/**
	 * Revalidates a tag in the suspense cache's tags manifest.
	 *
	 * @param tag Tag to revalidate.
	 */
	public async revalidateTag(tag: string): Promise<void> {
		// Update the revalidated timestamp for the tags in the tags manifest.
		await this.setTags([tag], { revalidatedAt: Date.now() });

		revalidatedTags.add(tag);
	}

	/**
	 * Loads the tags manifest from the suspense cache.
	 */
	public async loadTagsManifest(): Promise<void> {
		try {
			const rawManifest = await this.retrieve(this.tagsManifestKey);
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
			const newValue = JSON.stringify(this.tagsManifest);
			await this.update(this.tagsManifestKey, newValue);
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
		{ cacheKey, revalidatedAt }: { cacheKey?: string; revalidatedAt?: number }
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

// /** Suspense Cache interface for the Cache API. */
class CacheApiInterface extends CacheInterface {
	constructor(options: unknown) {
		super(options);
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

// /** Suspense Cache interface for Workers KV. */
// class KVCacheInterface extends CacheInterface<KVNamespace> {
// 	constructor(cache: KVNamespace) {
// 		super(cache);
// 	}

// 	public override async put(key: string, value: string) {
// 		await this.cache.put(key, value);
// 	}

// 	public override async get(key: string) {
// 		return this.cache.get(key);
// 	}

// 	public override async delete(key: string) {
// 		await this.cache.delete(key);
// 	}
// }

// /**
//  * Suspense Cache interface for D1.
//  *
//  * **Table Creation SQL**
//  * ```sql
//  * CREATE TABLE IF NOT EXISTS suspense_cache (key text PRIMARY KEY, value text NOT NULL);
//  * ```
//  */
// class D1CacheInterface extends CacheInterface<D1Database> {
// 	constructor(cache: D1Database) {
// 		super(cache);
// 	}

// 	public override async put(key: string, value: string) {
// 		const status = await this.cache
// 			.prepare(
// 				`INSERT OR REPLACE INTO suspense_cache (key, value) VALUES (?, ?)`
// 			)
// 			.bind(key, value)
// 			.run();
// 		if (status.error) throw new Error(status.error);
// 	}

// 	public override async get(key: string) {
// 		const value = await this.cache
// 			.prepare(`SELECT value FROM suspense_cache WHERE key = ?`)
// 			.bind(key)
// 			.first('value');
// 		return typeof value === 'string' ? value : null;
// 	}

// 	public override async delete(key: string) {
// 		await this.cache
// 			.prepare(`DELETE FROM suspense_cache WHERE key = ?`)
// 			.bind(key)
// 			.run();
// 	}
// }

// /** Suspense Cache interface for R2. */
// class R2CacheInterface extends CacheInterface<R2Bucket> {
// 	constructor(cache: R2Bucket) {
// 		super(cache);
// 	}

// 	public override async put(key: string, value: string) {
// 		await this.cache.put(key, value);
// 	}

// 	public override async get(key: string) {
// 		const value = await this.cache.get(key);
// 		return value ? value.text() : null;
// 	}

// 	public override async delete(key: string) {
// 		await this.cache.delete(key);
// 	}
// }

// https://github.com/vercel/next.js/blob/261db49/packages/next/src/server/lib/incremental-cache/file-system-cache.ts#L17
type TagsManifest = {
	version: 1;
	items: { [tag: string]: TagsManifestItem };
};
type TagsManifestItem = { keys: string[]; revalidatedAt?: number };

// https://github.com/vercel/next.js/blob/fda1ecc/packages/next/src/server/response-cache/types.ts#L16

type CachedFetchValue = {
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

type CachedImageValue = {
	kind: 'IMAGE';
	etag: string;
	buffer: Buffer;
	extension: string;
	isMiss?: boolean;
	isStale?: boolean;
};

type CacheHandlerValue = {
	lastModified?: number;
	age?: number;
	cacheState?: string;
	value: IncrementalCacheValue | null;
};
type IncrementalCacheValue = CachedImageValue | CachedFetchValue;

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
