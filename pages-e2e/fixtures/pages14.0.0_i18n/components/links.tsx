import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Links() {
	const { pathname } = useRouter();
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
			{pathname !== '/get-static-props' && (
				<Link href="/get-static-props" data-test-id="links__getStaticProps">
					To getStaticProps page
				</Link>
			)}

			{pathname !== '/get-static-props/[slug]' && (
				<Link
					href="/get-static-props/dynamic"
					data-test-id="links__getStaticPropsDynamic"
				>
					To dynamic getStaticProps page
				</Link>
			)}

			{pathname !== '/get-server-side-props' && (
				<Link
					href="/get-server-side-props"
					data-test-id="links__getServerSideProps"
				>
					To getServerSideProps page
				</Link>
			)}

			{pathname !== '/' && (
				<Link href="/" data-test-id="links__index">
					To index page
				</Link>
			)}
		</div>
	);
}
