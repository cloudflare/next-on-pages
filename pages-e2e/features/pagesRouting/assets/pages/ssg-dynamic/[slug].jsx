export async function getStaticPaths() {
	const slugs = ['foo', 'bar', 'baz'];
	return {
		paths: slugs.map(slug => ({
			params: { slug },
		})),
		fallback: false,
	};
}

export async function getStaticProps({ params: { slug } }) {
	return { props: { slug } };
}

export default function Page({ slug }) {
	return (
		<div>
			<h1>SSGed Dynamic Page</h1>
			<p>slug: {slug}</p>
		</div>
	);
}
