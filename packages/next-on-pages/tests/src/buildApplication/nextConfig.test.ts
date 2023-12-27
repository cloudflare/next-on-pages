import { vi, describe, test, expect } from 'vitest';
import {
	extractBuildMetadataConfig,
	getNextConfig,
} from '../../../src/buildApplication/nextConfig';

const mocks = vi.hoisted(() => ({
	nextConfigJsFileExists: true,
	nextConfigMjsFileExists: false,
}));

vi.mock('path', () => ({
	resolve: (str: string) => str,
}));

vi.mock('../../../src/utils/fs', () => ({
	validateFile: (file: string) => {
		if (file === 'next.config.js') return mocks.nextConfigJsFileExists;
		if (file === 'next.config.mjs') return mocks.nextConfigMjsFileExists;
		return false;
	},
}));

describe('getNextConfigJs', () => {
	test('neither next.config.js nor next.config.mjs file exists', async () => {
		mocks.nextConfigJsFileExists = false;
		mocks.nextConfigMjsFileExists = false;
		const config = await getNextConfig();
		expect(config).toBeNull();
	});

	test('processing a standard next.config.js file', async () => {
		mocks.nextConfigJsFileExists = true;
		mocks.nextConfigMjsFileExists = false;
		vi.doMock('next.config.js', () => ({
			default: {
				experimental: {
					incrementalCacheHandlerPath: 'my/incrementalCacheHandler/path',
				},
			},
		}));

		const config = await getNextConfig();

		expect(config).toEqual({
			experimental: {
				incrementalCacheHandlerPath: 'my/incrementalCacheHandler/path',
			},
		});
	});

	test('processing a standard next.config.mjs file', async () => {
		mocks.nextConfigJsFileExists = false;
		mocks.nextConfigMjsFileExists = true;

		vi.doMock('next.config.mjs', () => ({
			default: {
				trailingSlash: true,
			},
		}));

		const config = await getNextConfig();

		expect(config).toEqual({
			trailingSlash: true,
		});
	});

	test('processing a next.config.js file exporting a function', async () => {
		mocks.nextConfigJsFileExists = true;
		mocks.nextConfigMjsFileExists = false;

		vi.doMock('next.config.js', () => ({
			default: (
				_phase: string,
				{ defaultConfig }: { defaultConfig: { distDir: string } },
			) => {
				const nextConfig = {
					distDir: `default___${defaultConfig.distDir}`,
				};
				return nextConfig;
			},
		}));

		const config = await getNextConfig();

		expect(config).toEqual({
			distDir: 'default___.next',
		});
	});
});

describe('extractBuildMetadataConfig', () => {
	test('handles an empty object correctly', async () => {
		expect(extractBuildMetadataConfig({})).toEqual({});
	});

	test('extracts the desired metadata', async () => {
		expect(
			extractBuildMetadataConfig({
				experimental: {
					allowedRevalidateHeaderKeys: ['a', 'b', 'c'],
					fetchCacheKeyPrefix: 'my-prefix',
				},
			}),
		).toEqual({
			experimental: {
				allowedRevalidateHeaderKeys: ['a', 'b', 'c'],
				fetchCacheKeyPrefix: 'my-prefix',
			},
		});
	});

	test('extract only the desired data', async () => {
		expect(
			extractBuildMetadataConfig({
				experimental: {
					allowedRevalidateHeaderKeys: ['123'],
					incrementalCacheHandlerPath: '../../../test',
				},
				trailingSlash: true,
				eslint: {
					ignoreDuringBuilds: true,
				},
			}),
		).toEqual({
			experimental: {
				allowedRevalidateHeaderKeys: ['123'],
			},
		});
	});
});
