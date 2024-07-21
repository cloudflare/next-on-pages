export const runtime = 'edge';

export async function GET(request) {
	const url = new URL('/api/hello', request.url);
	const data = await fetch(url.href, { next: { tags: ['cache'] } });

	return new Response(
		JSON.stringify({
			body: await data.text(),
			headers: Object.fromEntries([...data.headers.entries()]),
		}),
	);
}
