import Link from 'next/link';

export default function NotFound() {
	return (
		<div>
			<h1>Not Found</h1>
			<h2>The requested page could not be found</h2>
			<Link href="/">Return Home</Link>
		</div>
	);
}
