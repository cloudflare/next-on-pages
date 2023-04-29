import { describe, test, expect } from 'vitest';
import type { MatchPCREResult } from '../../../templates/_worker.js/utils';
import { createNewRequest } from '../../../templates/_worker.js/utils';
import { applySearchParams } from '../../../templates/_worker.js/utils';
import { applyHeaders, isUrl } from '../../../templates/_worker.js/utils';

describe('applyHeaders', () => {
	test('applies headers from normal object', () => {
		const headers = new Headers({ foo: 'bar' });
		applyHeaders({ other: 'value' }, headers);

		expect(Object.fromEntries(headers.entries())).toEqual({
			foo: 'bar',
			other: 'value',
		});
	});

	test('applies headers from headers object', () => {
		const headers = new Headers({ foo: 'bar' });
		applyHeaders(new Headers({ other: 'value' }), headers);

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
		applyHeaders({ other: 'path/to/$path' }, headers, pcreMatch);

		expect(Object.fromEntries(headers.entries())).toEqual({
			foo: 'bar',
			other: 'path/to/index.html',
		});
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

		applySearchParams(source.searchParams, target.searchParams);

		expect([...source.searchParams.entries()].length).toEqual(1);
		expect([...target.searchParams.entries()].length).toEqual(2);

		expect(target.toString()).toEqual(
			'http://localhost/page?other=value&foo=bar'
		);
	});
});

describe('createNewRequest', () => {
	test('creates new request with the new path', () => {
		const prevReq = new Request('http://localhost/test');
		const request = createNewRequest(prevReq, '/new-path');

		expect(new URL(request.url).pathname).toEqual('/new-path');
	});

	test('creates new request with the new path without .html', () => {
		const prevReq = new Request('http://localhost/test');
		const request = createNewRequest(prevReq, '/new-path.html');

		expect(new URL(request.url).pathname).toEqual('/new-path');
	});
});
