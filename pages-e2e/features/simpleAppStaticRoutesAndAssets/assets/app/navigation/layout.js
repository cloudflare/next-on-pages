import Link from 'next/link';

export default function Layout({
	children, // will be a page or nested layout
}) {
	return (
		<>
			<div>
				<h1>Navigation</h1>
				<Link href="/navigation">to index</Link>
				<Link href="/navigation/pageA">to page A</Link>
				<Link href="/navigation/pageB">to page B</Link>
			</div>
			<hr />
			<main>{children}</main>
		</>
	);
}
