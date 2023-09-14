export const runtime = 'edge';

export default async function SomePage() {
	const message = await getServerSideMessage();

	return (
		<>
			<h1>{message}</h1>
		</>
	);
}

async function getServerSideMessage() {
	return 'This is the "header-somewhere-else" page';
}
