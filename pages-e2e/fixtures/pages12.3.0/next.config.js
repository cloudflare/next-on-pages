/** @type {import('next').NextConfig} */
module.exports = {
	reactStrictMode: true,
	experimental: {
		runtime: 'experimental-edge',
	},
	swcMinify: false,
	env: {
		frameworkVersion: '12',
	},
};
