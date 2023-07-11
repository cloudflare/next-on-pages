export const runtime = 'edge';

export default function handler(req) {
	const allCookies = [];
	req.cookies.getAll().forEach(({ value, name }) => {
		allCookies.push({ name, value });
	});

	const allHeaders = [];
	req.headers.forEach((value, name) => {
		allHeaders.push({ name, value });
	});

	return new Response(
		JSON.stringify({
			cookies: allCookies,
			headers: allHeaders,
		}),
	);
}
