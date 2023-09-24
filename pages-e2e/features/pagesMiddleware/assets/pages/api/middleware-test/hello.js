export const config = {
	runtime: 'experimental-edge',
};

export default async function handler(req) {
	return new Response('Hello middleware-test');
}
