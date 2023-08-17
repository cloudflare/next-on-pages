export const config = { runtime: 'experimental-edge' };

export default function Page({ title }) {
	return (
		<>
			<h1>{title}</h1>
			<h2>This page is static</h2>
		</>
	);
}

export async function getServerSideProps() {
	return {
		props: { title: 'This is the "some-page" page' },
	};
}
