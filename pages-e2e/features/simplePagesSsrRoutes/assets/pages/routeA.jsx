export const config = { runtime: 'experimental-edge' };

export async function getServerSideProps() {
	return {
		props: { message: 'This route was Server Side Rendered' },
	};
}

export default function SsrRouteA({ message }) {
	return (
		<>
			<h1>{message}</h1>
		</>
	);
}
