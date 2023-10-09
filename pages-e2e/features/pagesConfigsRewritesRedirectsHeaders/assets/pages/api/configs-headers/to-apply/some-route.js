export const config = {
	runtime: 'experimental-edge',
};

export default async function handler(req) {
	return new Response('api/configs-headers/to-apply/some-route route');
}
