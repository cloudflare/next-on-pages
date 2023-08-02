export const runtime = 'edge';

export default async function RouteA() {
	const message = await getServerSideMessage();

	return (
		<>
			<h1>{message}</h1>
		</>
	);
}

async function getServerSideMessage() {
	return 'This route was Server Side Rendered';
}
