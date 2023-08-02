/* eslint-disable no-console */
import type {
	CacheHandler,
	CacheHandlerValue,
} from 'next/dist/server/lib/incremental-cache';

declare const __BUILD_ID__: string;

const CACHE_ONE_YEAR = 31536000;

const getDerivedTags = (tags: string[]): string[] => {
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
};

type TagsManifest = {
	version: number;
	items: {
		[key: string]: {
			keys: string[];
		};
	};
};

export default class FetchCache implements CacheHandler {
	private headers: Record<string, string>;
	private debug: boolean;
	private revalidatedTags: string[];

	static isAvailable() {
		return true;
	}

	constructor() {
		this.debug = process.env.NODE_ENV === 'development';
		this.headers = {};
		this.headers['Content-Type'] = 'application/json';
		this.revalidatedTags = [];

		if (this.debug) {
			console.log('Using next-on-pages incremental cache handler');
		}
	}

	public async revalidateTag(tag: string) {
		if (this.debug) {
			console.log('revalidateTag', tag);
		}

		try {
			const tags = tag.split(',');
			const cache = await caches.open('next:cache');

			// Fetch the existing tags manifest
			const manifestKey = new Request(
				new URL(`https://next-on-page.com/${__BUILD_ID__}/tags-manifest.json`),
			);
			const manifestResponse = await cache.match(manifestKey);
			if (!manifestResponse) {
				throw new Error(`Tags manifest not found`);
			}
			const manifest = await manifestResponse.json<TagsManifest>();

			// Delete the tag from the manifest and invalidate related cache entries
			for (const tag of tags) {
				const tagItem = manifest.items[tag];
				if (tagItem) {
					// Invalidate related cache entries
					for (const key of tagItem.keys) {
						await cache.delete(
							new Request(
								new URL(`https://next-on-page.com/${__BUILD_ID__}${key}`),
							),
						);
					}
					// Delete the tag from the manifest
					delete manifest.items[tag];
				}
			}

			// Update the manifest in the cache
			const newManifestResponse = new Response(JSON.stringify(manifest), {
				headers: { 'Content-Type': 'application/json' },
			});
			await cache.put(manifestKey, newManifestResponse);

			if (this.debug) {
				console.log('Cache entries invalidated successfully', tag);
			}
		} catch (err) {
			console.warn(`Failed to revalidate tag ${tag}`, err);
		}
	}

	public async get(key: string, fetchCache?: boolean) {
		if (!fetchCache) return null;
		let data = undefined;

		// get data from fetch cache
		try {
			const cache = await caches.open('next:cache');
			const start = Date.now();
			const cacheKeyRequest = new Request(
				new URL(
					`https://next-on-page.com/${__BUILD_ID__}/v1/suspense-cache/${key}`,
				),
			);

			// Check whether the value is already available in the cache API
			const cachedResponse = await cache.match(cacheKeyRequest);
			if (!cachedResponse) {
				if (this.debug) {
					console.log(
						`no fetch cache entry for ${key}, duration: ${
							Date.now() - start
						}ms`,
					);
				}
				return null;
			}

			if (!cachedResponse.ok) {
				console.error(await cachedResponse.text());
				throw new Error(`invalid response from cache ${cachedResponse.status}`);
			}

			const cached = await cachedResponse.json<CacheHandlerValue['value']>();

			if (!cached || cached.kind !== 'FETCH') {
				this.debug && console.log({ cached });
				throw new Error(`invalid cache value`);
			}

			const cacheState = cachedResponse.headers.get('x-vercel-cache-state');
			const age = cachedResponse.headers.get('age');

			data = {
				value: cached,
				// if it's already stale set it to a time in the past
				// if not derive last modified from age
				lastModified:
					cacheState !== 'fresh'
						? Date.now() - CACHE_ONE_YEAR
						: Date.now() - parseInt(age || '0', 10) * 1000,
			};
			if (this.debug) {
				console.log(
					`got fetch cache entry for ${key}, duration: ${
						Date.now() - start
					}ms, size: ${Object.keys(cached).length}, cache-state: ${cacheState}`,
				);
			}
		} catch (err) {
			// unable to get data from fetch-cache
			if (this.debug) {
				console.error(`Failed to get from fetch-cache`, err);
			}
		}

		// if a tag was revalidated we don't return stale data
		if (data?.value?.kind === 'FETCH') {
			const innerData = data.value.data;
			const derivedTags = getDerivedTags(innerData.tags || []);

			if (
				derivedTags.some(tag => {
					return this.revalidatedTags.includes(tag);
				})
			) {
				data = undefined;
			}
		}

		return data || null;
	}

	public async set(
		key: string,
		data: CacheHandlerValue['value'],
		fetchCache?: boolean,
	) {
		if (!fetchCache) return;

		try {
			const cache = await caches.open('next:cache');
			const cacheKeyRequest = new Request(
				new URL(
					`https://next-on-page.com/${__BUILD_ID__}/v1/suspense-cache/${key}`,
				),
			);
			const start = Date.now();
			if (data !== null && 'revalidate' in data) {
				this.headers['x-vercel-revalidate'] = data.revalidate.toString();
			}
			if (
				!this.headers['x-vercel-revalidate'] &&
				data !== null &&
				'data' in data &&
				data.data.headers['cache-control']
			) {
				this.headers['x-vercel-cache-control'] =
					data.data.headers['cache-control'];
			}
			const body = JSON.stringify(data);
			const headers = { ...this.headers };
			if (data !== null && 'data' in data && data.data.tags) {
				headers['x-vercel-cache-tags'] = data.data.tags.join(',');
			}

			if (this.debug) {
				console.log('set cache', key, {
					tags: headers['x-vercel-cache-tags'],
				});
			}

			const responseHeaders = generateNextCacheHeaders(headers);
			const response = new Response(body, {
				status: 200,
				headers: responseHeaders,
			});
			await cache.put(cacheKeyRequest, response);
			// Process the x-vercel-cache-tags header
			const tagHeader = headers['x-vercel-cache-tags'];
			if (tagHeader) {
				// Fetch the existing tags manifest
				// we should probably try to use DO or R2 to have a unique global tags-manifest
				const manifestKey = new Request(
					new URL(
						`https://next-on-page.com/${__BUILD_ID__}/tags-manifest.json`,
					),
				);
				const manifestResponse = await cache.match(manifestKey);
				let manifest: TagsManifest;
				if (manifestResponse) {
					manifest = await manifestResponse.json();
				} else {
					// Initialize an empty manifest if it doesn't exist yet
					manifest = {
						version: 1,
						items: {},
					};
				}

				// Process the tags from the header
				const tags = tagHeader.split(',');
				for (const tag of tags) {
					if (!manifest.items[tag]) {
						manifest.items[tag] = { keys: [] };
					}
					if (!manifest.items[tag]?.keys.includes(key)) {
						manifest.items[tag]?.keys.push(key);
					}
				}

				// Update the manifest in the cache
				const newManifestResponse = new Response(JSON.stringify(manifest), {
					headers: {
						'Content-Type': 'application/json',
						'Cache-Control': 'max-age=31536000',
					},
				});
				await cache.put(manifestKey, newManifestResponse);
			}

			if (this.debug) {
				console.log(
					`successfully set to fetch-cache for ${key}, duration: ${
						Date.now() - start
					}ms, size: ${body.length}`,
				);
			}
		} catch (err) {
			// unable to set to fetch-cache
			if (this.debug) {
				console.error(`Failed to update fetch cache`, err);
			}
		}
		return;
	}
}

function generateNextCacheHeaders(headers: Record<string, string>) {
	const responseHeaders = new Headers(headers);
	if (responseHeaders.has('x-vercel-revalidate')) {
		const revalidateSecs = parseInt(
			responseHeaders.get('x-vercel-revalidate') as string,
			10,
		);
		const date = new Date();
		date.setSeconds(date.getSeconds() + revalidateSecs);
		responseHeaders.set('Cache-Control', `max-age=${revalidateSecs}`);
	} else if (responseHeaders.has('x-vercel-cache-control')) {
		const cacheControlValue = responseHeaders.get('x-vercel-cache-control');
		responseHeaders.set('Cache-Control', cacheControlValue as string);
	}
	return responseHeaders;
}
