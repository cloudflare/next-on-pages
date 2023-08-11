export const config = { runtime: 'experimental-edge' };

export async function getServerSideProps() {
	throw new Error('custom error');

	return {
		props: { message: 'hello world' },
	};
}

export default function PageA({ message }) {
	return (
		<div>
			<h1>Unaccessible page</h1>
			<p>this page should not be accessible since the component throws</p>
			<p>{message}</p>
		</div>
	);
}
