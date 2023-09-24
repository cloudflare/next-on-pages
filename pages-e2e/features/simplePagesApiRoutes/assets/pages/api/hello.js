// Next.js Edge API Routes: https://nextjs.org/docs/api-routes/edge-api-routes

export const config = {
	runtime: 'experimental-edge',
};

export default async function handler(req) {
	return new Response('Hello world');
}
