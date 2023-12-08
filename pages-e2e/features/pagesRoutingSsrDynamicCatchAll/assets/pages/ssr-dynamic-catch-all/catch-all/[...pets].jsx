import { useRouter } from 'next/router';

export const runtime = 'experimental-edge';

export default function SSRDynamicCatchAllPage() {
	const router = useRouter();

	return (
		<div>
			<p>The provided pets are:</p>
			<ul>
				{router.query.pets?.map((pet, i) => (
					<li key={pet}>
						{i} - {pet}
					</li>
				))}
			</ul>
		</div>
	);
}
