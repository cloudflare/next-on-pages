export const runtime = 'edge';

export async function GET(request) {
	return new Response('ERROR: This route should not be reachable!');
}
