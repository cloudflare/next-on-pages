import { headers } from 'next/headers';

export const runtime = 'edge';

export default async function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const serverSideInfo = await getServerSideInfo();
	return (
		<html lang="en">
			<body
				style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}
			>
				<div>
					<span
						style={{
							marginBlockEnd: '.5rem',
							display: 'inline-block',
							color: 'blue',
						}}
					>
						{serverSideInfo}
					</span>
					<div
						style={{
							padding: '1rem',
							border: '5px dashed blue',
							minWidth: '70vw',
							minHeight: '70vh',
						}}
					>
						{children}
					</div>
				</div>
			</body>
		</html>
	);
}

async function getServerSideInfo() {
	// Note: headers can only be called on the server
	const headersList = headers();
	const acceptHeader = headersList.get('accept');
	await new Promise(resolve => setTimeout(resolve, 200));
	return `[server side info] the request's accept header value is: "${acceptHeader}"`;
}
