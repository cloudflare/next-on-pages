import { Response } from 'miniflare';
import type { Request } from 'miniflare';

import { cloneHeaders } from './wrangler';

type Fetcher = (req: Request) => Promise<Response>;

export function getAIFetcher({
	accountId,
	apiToken,
}: {
	accountId: string;
	apiToken: string;
}): Fetcher {
	// Tweaked version of the wrangler ai fetcher
	// (source: https://github.com/cloudflare/workers-sdk/blob/912bfe/packages/wrangler/src/ai/fetcher.ts)
	return async function AIFetcher(request: Request) {
		request.headers.delete('Host');
		request.headers.delete('Content-Length');

		const res = await performApiFetch(
			`/accounts/${accountId}/ai/run/proxy`,
			{
				method: 'POST',
				headers: Object.fromEntries(request.headers.entries()),
				body: request.body as BodyInit,
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-ignore
				duplex: 'half',
			},
			apiToken,
		);

		return new Response(res.body, { status: res.status });
	};
}

// (Heavily) Simplified version of performApiFetch from wrangler
// (source: https://github.com/cloudflare/workers-sdk/blob/912bfe/packages/wrangler/src/cfetch/internal.ts#L18)
export async function performApiFetch(
	resource: string,
	init: RequestInit = {},
	apiToken: string,
) {
	const method = init.method ?? 'GET';
	const headers = cloneHeaders(init.headers);
	headers['Authorization'] = `Bearer ${apiToken}`;

	return fetch(`https://api.cloudflare.com/client/v4${resource}`, {
		method,
		...init,
		headers,
	});
}
