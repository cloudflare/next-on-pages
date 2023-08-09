export const config = {
	runtime: 'experimental-edge',
};

export default async function (req) {
	return new Response('ERROR: This route should not be reachable!');
}
