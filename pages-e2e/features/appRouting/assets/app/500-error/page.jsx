
export default function Page() {
	throw new Error('custom error');

	return (
		<div>
			<h1>Unaccessible page</h1>
			<p>this page shouldn't be accessible since the component throws</p>
		</div>
	);
}

export const runtime = 'edge';
