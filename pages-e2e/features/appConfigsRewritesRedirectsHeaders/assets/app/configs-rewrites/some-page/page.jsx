export const runtime = 'edge';

export default async function SomePage() {
	const message = await getServerSideMessage();

	return (
		<>
			<h1>{message}</h1>
			<h2>This page is static</h2>
		</>
	);
}

async function getServerSideMessage() {
	return 'This is the "some-page" page';
}
