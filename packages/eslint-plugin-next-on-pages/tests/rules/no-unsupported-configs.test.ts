import { RuleTester } from 'eslint';

import rule from '../../src/rules/no-unsupported-configs';
import { describe, test } from 'vitest';

const tester = new RuleTester({
	parser: require.resolve('@typescript-eslint/parser'),
});

describe('no-unsupported-configs', () => {
	test('should work with standard nextConfigs', () => {
		tester.run('', rule, {
			valid: [
				{
					filename: 'next.config.js',
					code: `
            /** @type {import('next').NextConfig} */
            const nextConfig = {
            }

            module.exports = nextConfig
          `,
				},
			],
			invalid: [
				{
					filename: 'next.config.js',
					code: `
            /** @type {import('next').NextConfig} */
            const nextConfig = {
              compress: true,
              serverRuntimeConfig: {},
            }

            module.exports = nextConfig
          `,
					errors: [
						{
							message:
								'The "compress" configuration is not supported by next-on-pages (and will likely never be).',
						},
						{
							message:
								'The "serverRuntimeConfig" configuration is not supported by next-on-pages (and will likely never be).',
						},
					],
				},
			],
		});
	});

	test('should work with custom named configs', () => {
		tester.run('no-unsupported-configs', rule, {
			valid: [
				{
					filename: 'next.config.js',
					code: `
            /** @type {import('next').NextConfig} */
            const cfg = {
            }

            module.exports = cfg
          `,
					options: [{ includeUnrecognized: true }],
				},
			],
			invalid: [
				{
					filename: 'next.config.js',
					code: `
            /** @type {import('next').NextConfig} */
            const cfg = {
              compress: true,
            };

            module.exports = cfg;
          `,
					errors: [
						{
							message:
								'The "compress" configuration is not supported by next-on-pages (and will likely never be).',
						},
					],
				},
			],
		});
	});

	test('should work with directly exported configs', () => {
		tester.run('no-unsupported-configs', rule, {
			valid: [
				{
					filename: 'next.config.js',
					code: `
            /** @type {import('next').NextConfig} */
            module.exports = {
            }
          `,
				},
			],
			invalid: [
				{
					filename: 'next.config.js',
					code: `
            /** @type {import('next').NextConfig} */
            module.exports = {
              distDir: 'my-dir',
            };
          `,
					errors: [
						{
							message:
								'The "distDir" configuration is not supported by next-on-pages (and will likely never be).',
						},
					],
				},
			],
		});
	});

	test('should handle includeCurrentlyUnsupported option', () => {
		const code = `
    /** @type {import('next').NextConfig} */
    const nextConfig = {
      assetPrefix: 'test',
      reactStrictMode: true,
    }

    module.exports = nextConfig
  `;
		tester.run('', rule, {
			valid: [
				{
					filename: 'next.config.js',
					code,
					options: [{ includeCurrentlyUnsupported: false }],
				},
			],
			invalid: [
				{
					filename: 'next.config.js',
					code,
					options: [{ includeCurrentlyUnsupported: true }],
					errors: [
						{
							message:
								'The "assetPrefix" configuration is not currently supported by next-on-pages.',
						},
						{
							message:
								'The "reactStrictMode" configuration is not currently supported by next-on-pages.',
						},
					],
				},
			],
		});
	});

	test('should handle includeUnrecognized option', () => {
		const code = `
    /** @type {import('next').NextConfig} */
    const nextConfig = {
      invalidTestConfig1: 'test',
      invalidTestConfig2: true,
    }

    module.exports = nextConfig
  `;
		tester.run('', rule, {
			valid: [
				{
					filename: 'next.config.js',
					code,
					options: [{ includeUnrecognized: false }],
				},
			],
			invalid: [
				{
					filename: 'next.config.js',
					code,
					options: [{ includeUnrecognized: true }],
					errors: [
						{
							message:
								'The "invalidTestConfig1" configuration is not recognized by next-on-pages (it might or might not be supported).',
						},
						{
							message:
								'The "invalidTestConfig2" configuration is not recognized by next-on-pages (it might or might not be supported).',
						},
					],
				},
			],
		});
	});

	test('should handle mixes of indefinitely unsupported, currently unsupported and unrecognized configs', () => {
		const code = `
      /** @type {import('next').NextConfig} */
      const nextConfig = {
        compress: true,
        invalidTestConfig1: 'test',
        serverRuntimeConfig: {},
        invalidTestConfig2: true,
        trailingSlash: true,
      }

      module.exports = nextConfig
    `;
		tester.run('', rule, {
			valid: [],
			invalid: [
				{
					filename: 'next.config.js',
					code,
					options: [
						{ includeCurrentlyUnsupported: true, includeUnrecognized: true },
					],
					errors: [
						{
							message:
								'The "compress" configuration is not supported by next-on-pages (and will likely never be).',
						},
						{
							message:
								'The "invalidTestConfig1" configuration is not recognized by next-on-pages (it might or might not be supported).',
						},
						{
							message:
								'The "serverRuntimeConfig" configuration is not supported by next-on-pages (and will likely never be).',
						},
						{
							message:
								'The "invalidTestConfig2" configuration is not recognized by next-on-pages (it might or might not be supported).',
						},
						{
							message:
								'The "trailingSlash" configuration is not currently supported by next-on-pages.',
						},
					],
				},
				{
					filename: 'next.config.js',
					code,
					options: [
						{ includeCurrentlyUnsupported: false, includeUnrecognized: true },
					],
					errors: [
						{
							message:
								'The "compress" configuration is not supported by next-on-pages (and will likely never be).',
						},
						{
							message:
								'The "invalidTestConfig1" configuration is not recognized by next-on-pages (it might or might not be supported).',
						},
						{
							message:
								'The "serverRuntimeConfig" configuration is not supported by next-on-pages (and will likely never be).',
						},
						{
							message:
								'The "invalidTestConfig2" configuration is not recognized by next-on-pages (it might or might not be supported).',
						},
					],
				},
				{
					filename: 'next.config.js',
					code,
					options: [
						{ includeCurrentlyUnsupported: true, includeUnrecognized: false },
					],
					errors: [
						{
							message:
								'The "compress" configuration is not supported by next-on-pages (and will likely never be).',
						},
						{
							message:
								'The "serverRuntimeConfig" configuration is not supported by next-on-pages (and will likely never be).',
						},
						{
							message:
								'The "trailingSlash" configuration is not currently supported by next-on-pages.',
						},
					],
				},
				{
					filename: 'next.config.js',
					code,
					options: [
						{ includeCurrentlyUnsupported: false, includeUnrecognized: false },
					],
					errors: [
						{
							message:
								'The "compress" configuration is not supported by next-on-pages (and will likely never be).',
						},
						{
							message:
								'The "serverRuntimeConfig" configuration is not supported by next-on-pages (and will likely never be).',
						},
					],
				},
			],
		});
	});

	test('should handle nested configs', () => {
		tester.run('', rule, {
			valid: [
				{
					filename: 'next.config.js',
					code: `
            /** @type {import('next').NextConfig} */
            const nextConfig = {
              env: {
                key: 'my-val',
              },
            }

            module.exports = nextConfig
          `,
					options: [{ includeUnrecognized: true }],
				},
			],
			invalid: [
				{
					filename: 'next.config.js',
					code: `
            /** @type {import('next').NextConfig} */
            const nextConfig = {
              experimental: {
                turbo: true,
              },
            }

            module.exports = nextConfig
          `,
					errors: [
						{
							message:
								'The "experimental/turbo" configuration is not currently supported by next-on-pages.',
						},
					],
				},
			],
		});
	});

	test('should handle includeUnrecognized option in nested configs', () => {
		const code = `
    /** @type {import('next').NextConfig} */
    const nextConfig = {
      experimental: {
        invalidExpTestConfig1: 'test',
        invalidExpTestConfig2: true,
      },
      invalidNested: {
        invalidExpTestConfig3: 'this should not get reached',
      }
    }

    module.exports = nextConfig
  `;
		tester.run('', rule, {
			valid: [
				{
					filename: 'next.config.js',
					code,
					options: [{ includeUnrecognized: false }],
				},
			],
			invalid: [
				{
					filename: 'next.config.js',
					code,
					options: [{ includeUnrecognized: true }],
					errors: [
						{
							message:
								'The "experimental/invalidExpTestConfig1" configuration is not recognized by next-on-pages (it might or might not be supported).',
						},
						{
							message:
								'The "experimental/invalidExpTestConfig2" configuration is not recognized by next-on-pages (it might or might not be supported).',
						},
						{
							message:
								'The "invalidNested" configuration is not recognized by next-on-pages (it might or might not be supported).',
						},
					],
				},
			],
		});
	});
});
