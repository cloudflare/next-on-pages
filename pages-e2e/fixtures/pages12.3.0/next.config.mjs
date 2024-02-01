/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	experimental: {
		runtime: 'experimental-edge',
	},
	swcMinify: false,
	env: {
		frameworkVersion: '12.3.0',
	},
};

export default nextConfig;
