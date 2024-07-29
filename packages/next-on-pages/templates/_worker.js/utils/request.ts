import { SUSPENSE_CACHE_URL } from '../../cache';

/**
 * Adjusts the request so that it is formatted as if it were provided by Vercel
 *
 * @param request the original request received by the worker
 * @returns the adjusted request to pass to Next
 */
export function adjustRequestForVercel(request: Request): Request {
	const adjustedHeaders = new Headers(request.headers);

	if (request.cf) {
		adjustedHeaders.set(
			'x-vercel-ip-city',
			encodeURIComponent(request.cf.city as string),
		);
		adjustedHeaders.set('x-vercel-ip-country', request.cf.country as string);
		adjustedHeaders.set(
			'x-vercel-ip-country-region',
			request.cf.regionCode as string,
		);
		adjustedHeaders.set('x-vercel-ip-latitude', request.cf.latitude as string);
		adjustedHeaders.set(
			'x-vercel-ip-longitude',
			request.cf.longitude as string,
		);
	}

	adjustedHeaders.set('x-vercel-sc-host', SUSPENSE_CACHE_URL);

	return new Request(request, { headers: adjustedHeaders });
}
