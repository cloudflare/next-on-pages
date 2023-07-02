import { describe, expect, test } from 'vitest';
import {
	buildCdnCgiImageUrl,
	formatResp,
	getResizingProperties,
	isRemotePatternMatch,
} from '../../../templates/_worker.js/utils';

describe('isRemotePatternMatch', () => {
	test('hostname matches correctly', () => {
		const config: VercelImageRemotePattern = {
			hostname: '^via\\.placeholder\\.com$',
		};

		const validUrl = new URL('https://via.placeholder.com/images/1.jpg');
		expect(isRemotePatternMatch(validUrl, config)).toEqual(true);

		const invalidUrl = new URL('https://example.com/images/1.jpg');
		expect(isRemotePatternMatch(invalidUrl, config)).toEqual(false);
	});

	test('protocol matches correctly', () => {
		const config: VercelImageRemotePattern = {
			protocol: 'https',
			hostname: '^via\\.placeholder\\.com$',
		};

		const validUrl = new URL('https://via.placeholder.com/images/1.jpg');
		expect(isRemotePatternMatch(validUrl, config)).toEqual(true);

		const invalidUrl = new URL('http://via.placeholder.com/images/1.jpg');
		expect(isRemotePatternMatch(invalidUrl, config)).toEqual(false);
	});

	test('port matches correctly', () => {
		const config: VercelImageRemotePattern = {
			hostname: '^via\\.placeholder\\.com$',
			port: '9000',
		};

		const validUrl = new URL('https://via.placeholder.com:9000/images/1.jpg');
		expect(isRemotePatternMatch(validUrl, config)).toEqual(true);

		const invalidUrl = new URL('http://via.placeholder.com/images/1.jpg');
		expect(isRemotePatternMatch(invalidUrl, config)).toEqual(false);
	});

	test('pathname matches correctly', () => {
		const config: VercelImageRemotePattern = {
			hostname: '^via\\.placeholder\\.com$',
			pathname: '^/images/.*$',
		};

		const validUrl = new URL('https://via.placeholder.com:9000/images/1.jpg');
		expect(isRemotePatternMatch(validUrl, config)).toEqual(true);

		const invalidUrl = new URL('http://via.placeholder.com/videos/1.mp4');
		expect(isRemotePatternMatch(invalidUrl, config)).toEqual(false);
	});
});

const baseUrl = 'https://localhost/_next/image?url=';
const baseValidUrl = `${baseUrl}%2Fimages%2F1.jpg`;
const baseConfig: VercelImagesConfig = {
	domains: ['example.com'],
	sizes: [640, 750, 828, 1080, 1200],
	remotePatterns: [{ hostname: '^via\\.placeholder\\.com$' }],
	formats: ['image/avif', 'image/webp'],
};

describe('getResizingProperties', () => {
	test('invalid method fails', () => {
		const url = new URL(baseValidUrl);
		const request = new Request(url, { method: 'POST' });

		expect(getResizingProperties(request, url)).toEqual(undefined);
	});

	describe('request search params', () => {
		test('invalid url fails', () => {
			const url = new URL(baseUrl);
			const req = new Request(url);

			expect(getResizingProperties(req, url)).toEqual(undefined);
		});

		test('invalid width fails', () => {
			const url = new URL(`${baseValidUrl}&w=abc`);
			const req = new Request(url);

			expect(getResizingProperties(req, url)).toEqual(undefined);
		});

		test('invalid quality fails', () => {
			const url = new URL(`${baseValidUrl}&w=100&q=abc`);
			const req = new Request(url);

			expect(getResizingProperties(req, url)).toEqual(undefined);
		});

		test('invalid width in images config fails', () => {
			const url = new URL(`${baseValidUrl}&w=100`);
			const req = new Request(url);

			expect(getResizingProperties(req, url, baseConfig)).toEqual(undefined);
		});

		test('invalid quality (>100) fails', () => {
			const url = new URL(`${baseValidUrl}&w=640&q=150`);
			const req = new Request(url);

			expect(getResizingProperties(req, url, baseConfig)).toEqual(undefined);
		});

		test('invalid quality (<0) fails', () => {
			const url = new URL(`${baseValidUrl}&w=640&q=-1`);
			const req = new Request(url);

			expect(getResizingProperties(req, url, baseConfig)).toEqual(undefined);
		});
	});

	describe('relative (same origin) image', () => {
		test('image with valid request options succeeds', () => {
			const url = new URL(`${baseValidUrl}&w=640`);
			const req = new Request(url);

			const result = getResizingProperties(req, url, baseConfig);
			expect(result).toEqual({
				imageUrl: new URL('https://localhost/images/1.jpg'),
				options: { format: undefined, width: 640, quality: 75 },
			});
		});

		test('svg image fails when config disallows svgs', () => {
			const url = new URL(`${baseValidUrl.replace('jpg', 'svg')}&w=640`);
			const req = new Request(url);
			const config = { ...baseConfig, dangerouslyAllowSVG: false };

			expect(getResizingProperties(req, url, config)).toEqual(undefined);
		});

		test('svg image succeeds when config allows svgs', () => {
			const url = new URL(`${baseValidUrl.replace('jpg', 'svg')}&w=640`);
			const req = new Request(url);
			const config = { ...baseConfig, dangerouslyAllowSVG: true };

			const result = getResizingProperties(req, url, config);
			expect(result).toEqual({
				imageUrl: new URL('https://localhost/images/1.svg'),
				options: { format: undefined, width: 640, quality: 75 },
			});
		});

		test('svg image succeeds when config allows them', () => {
			const url = new URL(`${baseValidUrl.replace('jpg', 'svg')}&w=640`);
			const req = new Request(url);
			const config = { ...baseConfig, dangerouslyAllowSVG: true };

			const result = getResizingProperties(req, url, config);
			expect(result).toEqual({
				imageUrl: new URL('https://localhost/images/1.svg'),
				options: { format: undefined, width: 640, quality: 75 },
			});
		});
	});

	describe('external image', () => {
		test('external image fails with disallowed domain', () => {
			const url = new URL(
				`${baseUrl}https%3A%2F%2Finvalid.com%2Fimage.jpg&w=640`
			);
			const req = new Request(url);

			expect(getResizingProperties(req, url, baseConfig)).toEqual(undefined);
		});

		test('external image succeeds with allowed domain', () => {
			const url = new URL(
				`${baseUrl}https%3A%2F%2Fexample.com%2Fimage.jpg&w=640`
			);
			const req = new Request(url);

			const result = getResizingProperties(req, url, baseConfig);
			expect(result).toEqual({
				imageUrl: new URL('https://example.com/image.jpg'),
				options: { format: undefined, width: 640, quality: 75 },
			});
		});

		test('external image suceeds with allowed remote pattern', () => {
			const url = new URL(
				`${baseUrl}https%3A%2F%2Fvia.placeholder.com%2Fimage.jpg&w=640`
			);
			const req = new Request(url);

			const result = getResizingProperties(req, url, baseConfig);
			expect(result).toEqual({
				imageUrl: new URL('https://via.placeholder.com/image.jpg'),
				options: { format: undefined, width: 640, quality: 75 },
			});
		});
	});

	describe('request headers', () => {
		test('return correct format for `accept` header (webp)', () => {
			const url = new URL(`${baseValidUrl}&w=640`);
			const req = new Request(url, { headers: { Accept: 'image/webp' } });

			const result = getResizingProperties(req, url, baseConfig);
			expect(result).toEqual({
				imageUrl: new URL('https://localhost/images/1.jpg'),
				options: { format: 'webp', width: 640, quality: 75 },
			});
		});

		test('return correct format for `accept` header (avif)', () => {
			const url = new URL(`${baseValidUrl}&w=640`);
			const req = new Request(url, {
				headers: { Accept: 'image/avif,image/webp' },
			});

			const result = getResizingProperties(req, url, baseConfig);
			expect(result).toEqual({
				imageUrl: new URL('https://localhost/images/1.jpg'),
				options: { format: 'avif', width: 640, quality: 75 },
			});
		});
	});
});

describe('buildCdnCgiImageUrl', () => {
	test('builds a valid URL for relative images', () => {
		const requestUrl = new URL(`${baseValidUrl}&w=640`);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const { imageUrl, options } = getResizingProperties(
			new Request(requestUrl),
			requestUrl,
			baseConfig
		)!;

		const result = buildCdnCgiImageUrl(requestUrl, imageUrl, options);
		expect(result).toEqual(
			'https://localhost/cdn-cgi/image/width=640,quality=75/images/1.jpg'
		);
	});

	test('builds a valid URL for external images', () => {
		const requestUrl = new URL(
			`${baseUrl}https%3A%2F%2Fexample.com%2Fimage.jpg&w=640`
		);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const { imageUrl, options } = getResizingProperties(
			new Request(requestUrl),
			requestUrl,
			baseConfig
		)!;

		const result = buildCdnCgiImageUrl(requestUrl, imageUrl, options);
		expect(result).toEqual(
			'https://localhost/cdn-cgi/image/width=640,quality=75/https://example.com/image.jpg'
		);
	});
});

describe('formatResp', () => {
	test('applies content security policy from the config', () => {
		const config = { ...baseConfig, contentSecurityPolicy: 'default-src' };
		const imageUrl = new URL('https://localhost/images/1.jpg');

		const newResp = formatResp(new Response(), imageUrl, config);
		expect(newResp.headers.get('Content-Security-Policy')).toEqual(
			'default-src'
		);
	});

	test('applies content disposition from the config', () => {
		const config = { ...baseConfig, contentDispositionType: 'inline' };
		const imageUrl = new URL('https://localhost/images/1.jpg');

		const newResp = formatResp(new Response(), imageUrl, config);
		expect(newResp.headers.get('Content-Disposition')).toEqual(
			'inline; filename="1.jpg"'
		);
	});
});
