export const runtime = 'edge';

export async function GET(request) {
	return new Response('api/configs-headers/not-to-apply/some-route route');
}
