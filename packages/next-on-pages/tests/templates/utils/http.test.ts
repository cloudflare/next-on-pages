import { describe, test, expect } from 'vitest';
import type { MatchPCREResult } from '../../../templates/_worker.js/utils';
import {
	applyHeaders,
	applySearchParams,
	createRouteRequest,
	isUrl,
	parseAcceptLanguage,
} from '../../../templates/_worker.js/utils';

describe('applyHeaders', () => {
	test('applies headers from normal object', () => {
		const headers = new Headers({ foo: 'bar' });
		applyHeaders(headers, { other: 'value' });

		expect(Object.fromEntries(headers.entries())).toEqual({
			foo: 'bar',
			other: 'value',
		});
	});

	test('applies headers from headers object', () => {
		const headers = new Headers({ foo: 'bar' });
		applyHeaders(headers, new Headers({ other: 'value' }));

		expect(Object.fromEntries(headers.entries())).toEqual({
			foo: 'bar',
			other: 'value',
		});
	});

	test('applies headers from object with pcre match', () => {
		const headers = new Headers({ foo: 'bar' });
		const pcreMatch: MatchPCREResult = {
			match: ['localhost/index.html', 'index.html'],
			captureGroupKeys: ['path'],
		};
		applyHeaders(headers, { other: 'path/to/$path' }, pcreMatch);

		expect(Object.fromEntries(headers.entries())).toEqual({
			foo: 'bar',
			other: 'path/to/index.html',
		});
	});

	test('appends `set-cookie` headers instead of overriding', () => {
		const headers = new Headers({ 'set-cookie': 'first-value' });
		applyHeaders(headers, { 'set-cookie': 'second-value' });

		expect([...headers.entries()]).toEqual([
			['set-cookie', 'first-value'],
			['set-cookie', 'second-value'],
		]);
	});
});

describe('isUrl', () => {
	test('returns true for valid url', () => {
		expect(isUrl('https://test.com')).toEqual(true);
	});

	test('returns false for invalid url', () => {
		expect(isUrl('test.com')).toEqual(false);
	});
});

describe('applySearchParams', () => {
	test('merges search params onto target', () => {
		const source = new URL('http://localhost/page?foo=bar');
		const target = new URL('http://localhost/page?other=value');

		expect([...source.searchParams.entries()].length).toEqual(1);
		expect([...target.searchParams.entries()].length).toEqual(1);

		applySearchParams(target.searchParams, source.searchParams);

		expect([...source.searchParams.entries()].length).toEqual(1);
		expect([...target.searchParams.entries()].length).toEqual(2);

		expect(target.toString()).toEqual(
			'http://localhost/page?other=value&foo=bar'
		);
	});
});

describe('createRouteRequest', () => {
	test('creates new request with the new path', () => {
		const prevReq = new Request('http://localhost/test');
		const request = createRouteRequest(prevReq, '/new-path');

		expect(new URL(request.url).pathname).toEqual('/new-path');
	});

	test('creates new request with the new path without .html', () => {
		const prevReq = new Request('http://localhost/test');
		const request = createRouteRequest(prevReq, '/new-path.html');

		expect(new URL(request.url).pathname).toEqual('/new-path');
	});

	test('creates new request with the new path without .html', () => {
		const prevReq = new Request('http://localhost/test');
		const request = createRouteRequest(prevReq, '/index.html');

		expect(new URL(request.url).pathname).toEqual('/');
	});
});

describe('parseAcceptLanguage', () => {
	test('extract the locales and sort by quality when present', () => {
		[
			{ header: '', expected: [] },
			{ header: 'en', expected: ['en'] },
			{ header: 'en-US,en', expected: ['en-US', 'en'] },
			{ header: 'en-US,en;q=0.9,es;q=0.8', expected: ['en-US', 'en', 'es'] },
			{
				header: 'en-US,fr;q=0.7,en;q=0.9,es;q=0.8',
				expected: ['en-US', 'en', 'es', 'fr'],
			},
			{
				header: 'fr;q=0.7,en;q=0.9,en-US,es;q=0.8',
				expected: ['en-US', 'en', 'es', 'fr'],
			},
			{
				header: 'fr;q = 0.7,en;q =0.9,en-US,es;q= 0.8',
				expected: ['en-US', 'en', 'es', 'fr'],
			},
		].forEach(({ header, expected }) => {
			const result = parseAcceptLanguage(header);
			expect(result).toEqual(expected);
		});
	});
});
