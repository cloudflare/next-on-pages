export function redirects() {
	return [
		{
			source: '/permanent-config-redirect',
			destination: '/permanent-config-redirect-destination',
			permanent: true,
		},
		{
			source: '/non-permanent-config-redirect',
			destination: '/non-permanent-config-redirect-destination',
			permanent: false,
		},
	];
}
