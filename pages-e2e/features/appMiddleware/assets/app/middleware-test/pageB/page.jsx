import Link from 'next/link';

export default function Page() {
	const links = [
		{
			href: '/middleware-test/pageC?redirect-to-page-a',
			text: 'go to page A via middleware redirect',
		},
		{
			href: '/middleware-test/pageC?rewrite-to-page-a',
			text: 'go to page C which is page A served via middleware rewrite',
		},
	];

	return (
		<div>
			<h1>Page B</h1>
			{links.map(({ href, text }) => (
				<div key={href}>
					<Link href={href}>{text}</Link>
				</div>
			))}
		</div>
	);
}

export const runtime = 'edge';
