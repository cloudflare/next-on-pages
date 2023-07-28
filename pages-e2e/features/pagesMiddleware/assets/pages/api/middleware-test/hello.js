export const config = {
	runtime: 'experimental-edge',
};

export default async function (req) {
	return new Response('Hello middleware-test');
}
