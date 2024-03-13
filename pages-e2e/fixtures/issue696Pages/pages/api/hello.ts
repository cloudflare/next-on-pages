export const runtime = 'edge';

export default function handler(req: Request) {
	return Response.json({ text: 'Hello world!' });
}
