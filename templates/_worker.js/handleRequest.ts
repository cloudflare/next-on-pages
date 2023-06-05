import type { MatchedSet } from './utils';
import { applyHeaders, runOrFetchBuildOutputItem } from './utils';
import { RoutesMatcher } from './routes-matcher';
import type { RequestContext } from '../../src/utils/requestContext';

/**
 * Handles a request by processing and matching it against all the routing phases.
 *
 * @param reqCtx Request Context object (contains all we need in to know regarding the request in order to handle it).
 * @param config The processed Vercel build output config.
 * @param output Vercel build output.
 * @returns An instance of the router.
 */
export async function handleRequest(
	reqCtx: RequestContext,
	config: ProcessedVercelConfig,
	output: VercelBuildOutput
): Promise<Response> {
	const matcher = new RoutesMatcher(config.routes, output, reqCtx);
	const match = await findMatch(matcher);

	return generateResponse(reqCtx, match, output);
}

/**
 * Finds a match for the request.
 *
 * @param matcher Instance of the matcher for the request.
 * @param phase The phase to run, either `none` or `error`.
 * @param skipErrorMatch Whether to skip the error match.
 * @returns The matched set of path, status, headers, and search params.
 */
async function findMatch(
	matcher: RoutesMatcher,
	phase: 'none' | 'error' = 'none',
	skipErrorMatch = false
): Promise<MatchedSet> {
	const result = await matcher.run(phase);

	if (
		result === 'error' ||
		(!skipErrorMatch && matcher.status && matcher.status >= 400)
	) {
		return findMatch(matcher, 'error', true);
	}

	return {
		path: matcher.path,
		status: matcher.status,
		headers: matcher.headers,
		searchParams: matcher.searchParams,
		body: matcher.body,
	};
}

/**
 * Serves a file from the Vercel build output.
 *
 * @param reqCtx Request Context object.
 * @param match The match from the Vercel build output.
 * @returns A response object.
 */
async function generateResponse(
	reqCtx: RequestContext,
	{ path = '/404', status, headers, searchParams, body }: MatchedSet,
	output: VercelBuildOutput
): Promise<Response> {
	// Redirect user to external URL for redirects.
	if (headers.normal.has('location')) {
		// Apply the search params to the location header.
		const location = headers.normal.get('location') ?? '/';
		const paramsStr = [...searchParams.keys()].length
			? `?${searchParams.toString()}`
			: '';
		headers.normal.set('location', `${location}${paramsStr}`);

		return new Response(null, { status, headers: headers.normal });
	}

	let resp =
		body !== undefined
			? // If we have a response body from matching, use it instead.
			  new Response(body, { status })
			: await runOrFetchBuildOutputItem(output[path], reqCtx, {
					path,
					status,
					headers,
					searchParams,
			  });

	const newHeaders = headers.normal;
	applyHeaders(newHeaders, resp.headers);
	applyHeaders(newHeaders, headers.important);

	resp = new Response(resp.body, {
		...resp,
		status: status || resp.status,
		headers: newHeaders,
	});

	return resp;
}

function generateNextCacheHeaders(headers: Headers) {
	const responseHeaders = new Headers(headers);
	if (responseHeaders.has('x-vercel-revalidate')) {
		const revalidateSecs = parseInt(
			responseHeaders.get('x-vercel-revalidate') as string,
			10
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

type TagsManifest = {
	version: number;
	items: {
		[key: string]: {
			keys: string[];
		};
	};
};

/**
 * Handles a next/cache request by checking the pathname.
 *
 * @param request Request object (contains all we need in to know regarding the request in order to handle it).
 * @param env The environment binding of the worker.
 * @returns A response object if we match the correct pathname or null.
 */
export async function handleNextCacheRequest(request: Request) {
	const cacheUrl = new URL(request.url);
	const key = cacheUrl.pathname.split('/')[5] as string;
	if (cacheUrl.pathname.startsWith('/__next/cache/v1/suspense-cache/')) {
		const cache = await caches.default;

		// Condition to handle /v1/suspense-cache/revalidate requests
		if (
			request.method === 'POST' &&
			cacheUrl.pathname === '/__next/cache/v1/suspense-cache/revalidate'
		) {
			const tagsParam = cacheUrl.searchParams.get('tags');
			if (!tagsParam) {
				return new Response('Missing tags parameter', { status: 400 });
			}
			const tags = tagsParam.split(',');

			// Fetch the existing tags manifest
			const manifestKey = new Request(
				new URL('/tags-manifest.json', cacheUrl.origin)
			);
			const manifestResponse = await cache.match(manifestKey);
			if (!manifestResponse) {
				return new Response('Tags manifest not found', { status: 404 });
			}

			const manifest = await manifestResponse.json<TagsManifest>();

			// Delete the tag from the manifest and invalidate related cache entries
			for (const tag of tags) {
				const tagItem = manifest.items[tag];
				if (tagItem) {
					// Invalidate related cache entries
					for (const key of tagItem.keys) {
						await cache.delete(new Request(new URL(key, cacheUrl.origin)));
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

			return new Response('Cache entries invalidated successfully', {
				status: 200,
			});
		}

		const responseHeaders = generateNextCacheHeaders(request.headers);

		if (request.method === 'POST') {
			const response = new Response(request.clone().body, {
				status: 200,
				headers: responseHeaders,
			});
			const cacheKey = new Request(cacheUrl);
			await cache.put(cacheKey, response);

			// Process the x-vercel-cache-tags header
			const tagHeader = request.headers.get('x-vercel-cache-tags');
			if (tagHeader) {
				// Fetch the existing tags manifest
				// we should probably try to use DO or R2 to have a unique global tags-manifest
				const manifestKey = new Request(
					new URL('/tags-manifest.json', cacheUrl.origin)
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
					if (!manifest.items[tag]?.keys.includes(cacheUrl.pathname)) {
						manifest.items[tag]?.keys.push(cacheUrl.pathname);
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

			return new Response(`added fetch cache entry for key ${key}`, {
				status: 201,
			});
		}

		// Check whether the value is already available in the cache API
		const cachedResponse = await cache.match(request);
		if (!cachedResponse) {
			return new Response(`no fetch cache entry for key ${key}`, {
				status: 404,
			});
		}

		return cachedResponse;
	}
	return null;
}
