export const runtime = 'edge';

export default async function PageB() {
	const title = await new Promise(resolve =>
		resolve('Server Side Rendered Page B')
	);
	return <h2>{title}</h2>;
}
