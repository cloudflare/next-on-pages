export const runtime = 'edge';

export default async function IndexPageA() {
	const title = await new Promise(resolve =>
		resolve('Server Side Rendered Index')
	);
	return <h2>{title}</h2>;
}
