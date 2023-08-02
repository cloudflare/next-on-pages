import Layout from './layout';

export const config = { runtime: 'experimental-edge' };

export async function getServerSideProps() {
	return {
		props: { title: 'Server Side Rendered Page B' },
	};
}

export default function PageB({ title }) {
	return (
		<Layout>
			<h2>{title}</h2>
		</Layout>
	);
}
