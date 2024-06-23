import { headers } from 'next/headers';

export const runtime = 'edge';

export default function Home() {
	const headerFromMiddleware = headers().get('X-header-from-middleware');

	return (
		<main>
			<p data-test-id="header-from-middleware">
				header from middleware: {headerFromMiddleware}
			</p>
		</main>
	);
}
