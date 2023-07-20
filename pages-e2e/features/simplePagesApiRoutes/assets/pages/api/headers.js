export const config = {
	runtime: 'experimental-edge',
};

export default function handler(req) {
	const allCookies = [];

	if (typeof req.cookies.getAll !== 'function') {
		// Next.js <= 12
		Array.from(req.cookies.keys()).forEach(name => {
			const value = req.cookies.get(name);
			allCookies.push({ name, value });
		});
	} else {
		// Next.js >= 13
		req.cookies.getAll().forEach(({ value, name }) => {
			allCookies.push({ name, value });
		});
	}

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
