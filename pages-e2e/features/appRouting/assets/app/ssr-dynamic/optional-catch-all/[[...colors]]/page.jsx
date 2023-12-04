export const runtime = 'edge';

export default function SSRDynamicOptionalCatchAllPage({ params }) {
	return (
		<div>
			{!params.colors ? (
				<p>No color provided</p>
			) : (
				<>
					<p>The provided colors are:</p>
					<ul>
						{params.colors.map((color, i) => (
							<li key={color}>
								{i} - {color}
							</li>
						))}
					</ul>
				</>
			)}
		</div>
	);
}
