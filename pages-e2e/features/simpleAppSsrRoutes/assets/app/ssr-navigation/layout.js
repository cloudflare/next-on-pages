import Link from 'next/link';

export default async function Layout({ children }) {
	const title = await new Promise(resolve =>
		resolve('Server Side Rendered Navigation'),
	);

	return (
		<>
			<div>
				<h1>{title}</h1>
				<Link href="/ssr-navigation">to index</Link>
				<Link href="/ssr-navigation/pageA">to page A</Link>
				<Link href="/ssr-navigation/pageB">to page B</Link>
			</div>
			<hr />
			<main>{children}</main>
		</>
	);
}
