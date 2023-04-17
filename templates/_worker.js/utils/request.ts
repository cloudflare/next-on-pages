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

	return new Request(request, { headers: adjustedHeaders });
}
