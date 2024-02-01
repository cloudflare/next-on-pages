export function headers() {
	return [
		{
			source: '/api/configs-headers/to-apply/:path*',
			headers: [
				{
					key: 'x-custom-configs-header',
					value: 'my custom header value (from next.config.mjs)',
				},
				{
					key: 'x-another-custom-configs-header',
					value: 'my other custom header value (from next.config.mjs)',
				},
			],
		},
	];
}
