import { cookies, headers } from 'next/headers';

export const runtime = 'edge';

export async function GET() {
	const allCookies = [];
	cookies()
		.getAll()
		.forEach(({ name, value }) => {
			allCookies.push({ name, value });
		});

	const allHeaders = [];
	headers().forEach((value, name) => {
		allHeaders.push({ name, value });
	});

	return new Response(
		JSON.stringify({
			cookies: allCookies,
			headers: allHeaders,
		})
	);
}
