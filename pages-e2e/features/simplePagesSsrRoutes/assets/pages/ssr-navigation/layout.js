import Link from 'next/link';

export default function Layout({ children }) {
	return (
		<>
			<div>
				<h1>Navigation</h1>
				<Link href="/ssr-navigation">to index</Link>
				<Link href="/ssr-navigation/pageA">to page A</Link>
				<Link href="/ssr-navigation/pageB">to page B</Link>
			</div>
			<hr />
			<main>{children}</main>
		</>
	);
}
