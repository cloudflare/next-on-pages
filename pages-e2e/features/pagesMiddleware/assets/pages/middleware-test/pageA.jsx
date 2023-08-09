export const config = { runtime: 'experimental-edge' };

export async function getServerSideProps(context) {
	const requestHeaders = [];
	Object.entries(context.req?.headers ?? {}).forEach(([key, value]) => {
		requestHeaders.push({ key, value });
	});
	return {
		props: { requestHeaders },
	};
}

export default function Page({ requestHeaders }) {
	return (
		<div>
			<h1>Page A</h1>
			<h2>Headers</h2>
			<p>The request contained the following headers:</p>
			<ul>
				{requestHeaders.map(({ key, value }) => (
					<li id={`header-${key}`} key={key}>
						<span>{key}</span>: <span>{value}</span>
					</li>
				))}
			</ul>
			{process.env.frameworkVersion?.startsWith('12') && (
				<p>Note: this application runs on Next.js v12</p>
			)}
		</div>
	);
}
