import type {
	CacheHandler,
	CacheHandlerContext,
	CacheHandlerValue,
	IncrementalCache,
	TagsManifest,
} from './incrementalCache';

// NOTE: This is given the same name that the environment variable has in the Next.js source code.
export const SUSPENSE_CACHE_URL = 'INTERNAL_SUSPENSE_CACHE_HOSTNAME.local';

// https://github.com/vercel/next.js/blob/f6babb4/packages/next/src/lib/constants.ts#23
const NEXT_CACHE_IMPLICIT_TAG_ID = '_N_T_';

/** A Shared base for built-in cache handlers. */
export class BuiltInCacheHandler implements CacheHandler {
	/** The tags manifest for fetch calls. */
	public tagsManifest: TagsManifest | undefined;
	/** The key used for the tags manifest in the cache. */
	public tagsManifestKey = 'tags-manifest';

	// Set to track the revalidated tags in requests.
	private revalidatedTags: Set<string>;

	/**
	 * @param ctx The incremental cache context.
	 */
	constructor(protected ctx: CacheHandlerContext) {
		this.revalidatedTags = new Set(ctx.revalidatedTags);
	}

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
	 * @param cacheKey Key for the item in the suspense cache.
	 * @param value The cached value to add to the suspense cache.
	 * @param ctx The cache handler context.
	 */
	public async set(
		...[cacheKey, value, ctx]: Parameters<IncrementalCache['set']>
	): Promise<void> {
		const newEntry: CacheHandlerValue = {
			lastModified: Date.now(),
			value,
		};

		// Update the cache entry.
		await this.update(cacheKey, JSON.stringify(newEntry));

		switch (newEntry.value?.kind) {
			case 'FETCH': {
				// Update the tags with the cache key.
				const tags = getTagsFromEntry(newEntry) ?? ctx.tags ?? [];
				await this.setTags(tags, { cacheKey: cacheKey });

				const derivedTags = getDerivedTags(tags);
				const implicitTags = derivedTags.map(
					tag => `${NEXT_CACHE_IMPLICIT_TAG_ID}${tag}`,
				);

				[...derivedTags, ...implicitTags].forEach(tag =>
					this.revalidatedTags.delete(tag),
				);
			}
		}
	}

	/**
	 * Retrieves an entry from the suspense cache.
	 *
	 * @param key Key for the item in the suspense cache.
	 * @param ctx The cache handler context.
	 * @returns The cached value, or null if no entry exists.
	 */
	public async get(
		...[cacheKey, ctx]: Parameters<IncrementalCache['get']>
	): Promise<CacheHandlerValue | null> {
		// Get entry from the cache.
		const entry = await this.retrieve(cacheKey);
		if (!entry) return null;

		let data: CacheHandlerValue;
		try {
			data = JSON.parse(entry) as CacheHandlerValue;
		} catch (e) {
			// Failed to parse the cache entry, so it's invalid.
			return null;
		}

		switch (data.value?.kind) {
			case 'FETCH': {
				// Load the tags manifest.
				await this.loadTagsManifest();

				// Check if the cache entry is stale or fresh based on the tags.
				const tags = getTagsFromEntry(data);
				const combinedTags = ctx?.softTags
					? [...(tags ?? []), ...ctx.softTags]
					: getDerivedTags(tags ?? []);

				const isStale = combinedTags.some(tag => {
					// If a revalidation has been triggered, the current entry is stale.
					if (this.revalidatedTags.has(tag)) return true;

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

		this.revalidatedTags.add(tag);
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

		this.tagsManifest ??= { version: 1, items: {} };
	}

	/**
	 * Saves the local tags manifest in the suspense cache.
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

/**
 * Derives a list of tags from the given tags. This is taken from the Next.js source code.
 *
 * @see https://github.com/vercel/next.js/blob/1286e145/packages/next/src/server/lib/incremental-cache/utils.ts
 *
 * @param tags Array of tags.
 * @returns Derived tags.
 */
export function getDerivedTags(tags: string[]): string[] {
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

export function getTagsFromEntry(
	entry: CacheHandlerValue,
): string[] | undefined {
	return entry.value?.tags ?? entry.value?.data?.tags;
}
