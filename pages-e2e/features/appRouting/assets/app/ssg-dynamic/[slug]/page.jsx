export const dynamicParams = false;

export function generateStaticParams() {
	const slugs = ['foo', 'bar', 'baz'];
	return slugs.map(slug => ({ slug }));
};

export default function Page({ params }) {
	return (
		<div>
			<h1>SSGed Dynamic Page</h1>
			<p>slug: {params.slug}</p>
		</div>
	);
}
