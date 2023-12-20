// NOTE: this file is mostly a simplified version of an equivalent file in the Next.js codebase, most logic here
//       is a simplified and/or tweaked version aimed for next-on-pages usage
//       (the Next.js file: https://github.com/vercel/next.js/blob/c4adae8/packages/next/src/server/lib/incremental-cache/index.ts)

// source:https://github.com/vercel/next.js/blob/0fc1d9e98/packages/next/src/lib/constants.ts#L17
export const NEXT_CACHE_REVALIDATED_TAGS_HEADER = 'x-next-revalidated-tags';

/**
 * Simplified version of the interface of the same name from Next.js
 * source: https://github.com/vercel/next.js/blob/0fc1d9e982/packages/next/src/server/lib/incremental-cache/index.ts#L26-L39
 */
export interface CacheHandlerContext {
	revalidatedTags: string[];
	_requestHeaders: IncrementalCache['requestHeaders'];
	fetchCacheKeyPrefix?: string;
}

/* eslint-disable --
	the following class comes from the Next.js source code:
	https://github.com/vercel/next.js/blob/3b64a53e59/packages/next/src/server/lib/incremental-cache/index.ts#L48-L63
	eslint is disabled for it just so that we can keep the code as is without modifications
*/
export class CacheHandler {
	// eslint-disable-next-line
	constructor(_ctx: CacheHandlerContext) {}

	public async get(
		..._args: Parameters<IncrementalCache['get']>
	): Promise<CacheHandlerValue | null> {
		return {} as any;
	}

	public async set(
		..._args: Parameters<IncrementalCache['set']>
	): Promise<void> {}

	public async revalidateTag(_tag: string): Promise<void> {}
}
/* eslint-enable */

/**
 * Simplified (and tweaked) version of the IncrementalCache from Next.js
 * source: https://github.com/vercel/next.js/blob/c4adae89b/packages/next/src/server/lib/incremental-cache/index.ts#L65
 */
export class IncrementalCache {
	cacheHandler: CacheHandler;
	requestHeaders: Record<string, undefined | string | string[]>;
	revalidatedTags?: string[];

	constructor({
		curCacheHandler,
		requestHeaders,
		fetchCacheKeyPrefix,
	}: {
		allowedRevalidateHeaderKeys?: string[];
		requestHeaders: IncrementalCache['requestHeaders'];
		fetchCacheKeyPrefix?: string;
		curCacheHandler: typeof CacheHandler;
	}) {
		this.requestHeaders = requestHeaders;

		let revalidatedTags: string[] = [];

		if (
			typeof requestHeaders[NEXT_CACHE_REVALIDATED_TAGS_HEADER] === 'string'
		) {
			revalidatedTags =
				requestHeaders[NEXT_CACHE_REVALIDATED_TAGS_HEADER].split(',');
		}

		this.cacheHandler = new curCacheHandler({
			revalidatedTags,
			_requestHeaders: requestHeaders,
			fetchCacheKeyPrefix,
		});
	}

	async revalidateTag(tag: string) {
		return this.cacheHandler?.revalidateTag(tag);
	}

	async get(
		cacheKey: string,
		ctx: {
			kindHint?: IncrementalCacheKindHint;
			revalidate?: number | false;
			fetchUrl?: string;
			fetchIdx?: number;
			tags?: string[];
			softTags?: string[];
		} = {},
	): Promise<(IncrementalCacheEntry & { age?: number }) | null> {
		let entry: (IncrementalCacheEntry & { age?: number }) | null = null;
		let revalidate = ctx.revalidate;

		const cacheData = await this.cacheHandler.get(cacheKey, ctx);

		const age = cacheData
			? (Date.now() - (cacheData.lastModified || 0)) / 1000
			: undefined;

		if (cacheData?.value?.kind === 'FETCH') {
			const combinedTags = [...(ctx.tags || []), ...(ctx.softTags || [])];
			// if a tag was revalidated we don't return stale data
			if (
				combinedTags.some(tag => {
					return this.revalidatedTags?.includes(tag);
				})
			) {
				return null;
			}

			revalidate = revalidate || cacheData.value.revalidate;
			const isStale =
				typeof revalidate === 'number' &&
				typeof age === 'number' &&
				age > revalidate;
			const data = cacheData.value.data;

			return {
				isStale: isStale,
				value: {
					kind: 'FETCH',
					data,
					revalidate: revalidate,
				},
				age,
				revalidateAfter:
					typeof revalidate === 'number' && Date.now() + revalidate * 1000,
			};
		}

		let isStale: boolean | -1 | undefined;
		let revalidateAfter: false | number;

		if (cacheData?.lastModified === -1) {
			revalidateAfter = -1 * CACHE_ONE_YEAR;
			isStale = -1;
		} else {
			revalidateAfter = 1 * 1000 + (cacheData?.lastModified || Date.now());
			isStale = revalidateAfter < Date.now() ? true : undefined;
		}

		entry = {
			isStale,
			revalidateAfter,
			value: null,
		};

		if (cacheData) {
			entry.value = cacheData.value;
			entry.age = age;
		} else {
			await this.set(cacheKey, entry.value, ctx);
		}

		return {
			...entry,
			age,
		};
	}

	async set(
		pathname: string,
		data: IncrementalCacheValue | null,
		ctx: {
			revalidate?: number | false;
			fetchUrl?: string;
			fetchIdx?: number;
			tags?: string[];
		},
	) {
		await this.cacheHandler.set(pathname, data, ctx);
	}
}

// https://github.com/vercel/next.js/blob/0fc1d9e982/packages/next/src/server/response-cache/types.ts#L131
type IncrementalCacheKindHint = 'app' | 'pages' | 'fetch';

// https://github.com/vercel/next.js/blob/0fc1d9e982/packages/next/src/server/response-cache/types.ts#L83-L90
export type IncrementalCacheEntry = {
	curRevalidate?: number | false;
	// milliseconds to revalidate after
	revalidateAfter: number | false;
	// -1 here dictates a blocking revalidate should be used
	isStale?: boolean | -1;
	value: IncrementalCacheValue | null;
};

const CACHE_ONE_YEAR = 31536000;

// https://github.com/vercel/next.js/blob/261db49/packages/next/src/server/lib/incremental-cache/file-system-cache.ts#L17
export type TagsManifest = {
	version: 1;
	items: { [tag: string]: TagsManifestItem };
};
export type TagsManifestItem = { keys: string[]; revalidatedAt?: number };

// https://github.com/vercel/next.js/blob/df4c2aa8/packages/next/src/server/response-cache/types.ts#L24
export type CachedFetchValue = {
	kind: 'FETCH';
	data: {
		headers: { [k: string]: string };
		body: string;
		url: string;
		status?: number;
		// field used by older versions of Next.js (see: https://github.com/vercel/next.js/blob/fda1ecc/packages/next/src/server/response-cache/types.ts#L23)
		tags?: string[];
	};
	// tags are only present with file-system-cache
	// fetch cache stores tags outside of the cache entry's data
	tags?: string[];
	revalidate: number;
};

// https://github.com/vercel/next.js/blob/0fc1d9e982/packages/next/src/server/lib/incremental-cache/index.ts#L41-L46
export type CacheHandlerValue = {
	lastModified?: number;
	age?: number;
	cacheState?: string;
	value: IncrementalCacheValue | null;
};

// source: https://github.com/vercel/next.js/blob/0fc1d9e982c/packages/next/src/server/response-cache/types.ts#L92
// Note: the type is much simplified here
export type IncrementalCacheValue = CachedFetchValue;
