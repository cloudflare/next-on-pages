export const config = { runtime: 'experimental-edge' };

export default function Page({ title }) {
	return (
			<h1>{title}</h1>
	);
}

export async function getServerSideProps() {
	return {
		props: { title: 'This is the "query-somewhere-else" page' },
	};
}