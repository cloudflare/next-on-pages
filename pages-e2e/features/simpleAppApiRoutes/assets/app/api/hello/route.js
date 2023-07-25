export const runtime = 'edge';

export async function GET(request) {
	return new Response('Hello world');
}
