export const runtime = 'edge';

export async function GET(req: Request) {
	return Response.json({ text: 'Hello world!' });
}
