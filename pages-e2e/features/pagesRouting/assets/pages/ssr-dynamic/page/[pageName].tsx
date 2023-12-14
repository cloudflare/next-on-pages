import { useRouter } from 'next/router';

export const runtime = 'experimental-edge';

export default function SSRDynamicPageWithName() {
	const router = useRouter();
	return (
		<div>
			<p>This Page's name is: {router.query.pageName}</p>
		</div>
	);
}
