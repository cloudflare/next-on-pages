/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	swcMinify: true,
	experimental: {
		runtime: "experimental-edge",
	},
};

module.exports = nextConfig;
