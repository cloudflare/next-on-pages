export const runtime = 'edge';

export default async function PageA() {
	const title = await new Promise(resolve =>
		resolve('Server Side Rendered Page A'),
	);
	return <h2>{title}</h2>;
}
