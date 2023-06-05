/**
 * Adjusts the request so that it is formatted as if it were provided by Vercel
 *
 * @param request the original request received by the worker
 * @returns the adjusted request to pass to Next
 */
export function adjustRequestForVercel(request: Request): Request {
	const adjustedHeaders = new Headers(request.headers);

	if (request.cf) {
		adjustedHeaders.append('x-vercel-ip-city', request.cf.city as string);
		adjustedHeaders.append('x-vercel-ip-country', request.cf.country as string);
		adjustedHeaders.append(
			'x-vercel-ip-country-region',
			request.cf.region as string
		);
		adjustedHeaders.append(
			'x-vercel-ip-latitude',
			request.cf.latitude as string
		);
		adjustedHeaders.append(
			'x-vercel-ip-longitude',
			request.cf.longitude as string
		);
	}

	// next/cache headers for the internal FetchCache Handler
	const url = new URL(request.url);
	const hostname =
		url.hostname.includes('localhost') || url.hostname.includes('127.0.0.1')
			? `${url.hostname}:${url.port ? url.port : ''}`
			: url.hostname;
	adjustedHeaders.append('x-vercel-sc-host', hostname);
	adjustedHeaders.append('x-vercel-sc-basepath', '/__next/cache');

	return new Request(request, { headers: adjustedHeaders });
}
