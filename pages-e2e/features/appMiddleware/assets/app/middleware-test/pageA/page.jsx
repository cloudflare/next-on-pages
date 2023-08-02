import { headers } from 'next/headers';

export default function Page() {
	const requestHeaders = [];
	headers().forEach((value, key) => {
		requestHeaders.push({ key, value });
	});

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
		</div>
	);
}

export const runtime = 'edge';
