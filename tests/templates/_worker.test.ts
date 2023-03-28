import { describe, test, expect } from 'vitest';
import { routesMatcher } from '../../templates/_worker.js/index.js';

describe('routesMatcher', () => {
	const requestGenerator = (
		input: RequestInfo | URL,
		init?: RequestInit
	): Request => {
		if (typeof input === 'string' && input.startsWith('/')) {
			input = new URL(input, 'https://example.com/');
		}
		return new Request(input, init);
	};

	test('empty routes', () => {
		const request = (...args: Parameters<typeof requestGenerator>) =>
			routesMatcher({ request: requestGenerator(...args) });

		expect(request('/').length).toBe(0);
	});

	test('src', () => {
		const fooRoute = { src: '/foo', continue: true };
		const barRoute = { src: '/bar', continue: true };
		const catchAllRoute = { src: '/.*', continue: true };
		const routes = [fooRoute, barRoute, catchAllRoute];

		const request = (...args: Parameters<typeof requestGenerator>) =>
			routesMatcher({ request: requestGenerator(...args) }, routes);

		expect(request('/foo')).toEqual([fooRoute, catchAllRoute]);
		expect(request('/bar')).toEqual([barRoute, catchAllRoute]);
		expect(request('/')).toEqual([catchAllRoute]);
	});

	test('caseSensitive', () => {
		const caseSensitiveRoute = {
			src: '/foo',
			continue: true,
			caseSensitive: true,
		};
		const caseInsensitiveRoute = {
			src: '/foo',
			continue: true,
			caseSensitive: false,
		};
		const defaultCaseSensitivityRoute = { src: '/foo', continue: true };
		const routes = [
			caseSensitiveRoute,
			caseInsensitiveRoute,
			defaultCaseSensitivityRoute,
		];

		const request = (...args: Parameters<typeof requestGenerator>) =>
			routesMatcher({ request: requestGenerator(...args) }, routes);

		expect(request('/foo')).toEqual([
			caseSensitiveRoute,
			caseInsensitiveRoute,
			defaultCaseSensitivityRoute,
		]);
		expect(request('/Foo')).toEqual([
			caseInsensitiveRoute,
			defaultCaseSensitivityRoute,
		]);
	});

	test('methods', () => {
		const getRoute = { src: '/', methods: ['GET'], continue: true };
		const postRoute = { src: '/', methods: ['post'], continue: true };
		const noMethodRoute = { src: '/', continue: true };
		const routes = [getRoute, postRoute, noMethodRoute];

		const request = (...args: Parameters<typeof requestGenerator>) =>
			routesMatcher({ request: requestGenerator(...args) }, routes);

		expect(request('/', { method: 'get' })).toEqual([getRoute, noMethodRoute]);
		expect(request('/', { method: 'POST' })).toEqual([
			postRoute,
			noMethodRoute,
		]);
		expect(request('/', { method: 'PaTcH' })).toEqual([noMethodRoute]);
	});

	describe('has', () => {
		test('host', () => {
			const hostRoute = {
				src: '/',
				has: [{ type: 'host', value: 'example.com' }],
				continue: true,
			};
			const otherHostRoute = {
				src: '/',
				has: [{ type: 'host', value: 'fakehost' }],
				continue: true,
			};
			const routes = [hostRoute, otherHostRoute];

			const request = (...args: Parameters<typeof requestGenerator>) =>
				routesMatcher({ request: requestGenerator(...args) }, routes);

			expect(request('https://example.com/')).toEqual([hostRoute]);
			expect(request('https://fakehost/')).toEqual([otherHostRoute]);
			expect(request('https://foobar/')).toEqual([]);
		});

		test('header', () => {
			const headerRoute = {
				src: '/',
				has: [{ type: 'header', key: 'x-header' }],
				continue: true,
			};
			const headerValueRoute = {
				src: '/',
				has: [{ type: 'header', key: 'x-header', value: 'foo' }],
				continue: true,
			};
			const routes = [headerRoute, headerValueRoute];

			const request = (...args: Parameters<typeof requestGenerator>) =>
				routesMatcher({ request: requestGenerator(...args) }, routes);

			expect(request('/', { headers: { 'X-HEADER': 'bar' } })).toEqual([
				headerRoute,
			]);
			expect(request('/', { headers: { 'X-Header': 'foo' } })).toEqual([
				headerRoute,
				headerValueRoute,
			]);
			expect(request('/')).toEqual([]);
		});

		test('cookie', () => {
			const cookieRoute = {
				src: '/',
				has: [{ type: 'cookie', key: 'mycookie' }],
				continue: true,
			};
			const cookieValueRoute = {
				src: '/',
				has: [{ type: 'cookie', key: 'mycookie', value: 'jar' }],
				continue: true,
			};
			const routes = [cookieRoute, cookieValueRoute];

			const request = (...args: Parameters<typeof requestGenerator>) =>
				routesMatcher({ request: requestGenerator(...args) }, routes);

			expect(
				request('/', { headers: { Cookie: 'mycookie=foo; other=val' } })
			).toEqual([cookieRoute]);
			expect(
				request('/', { headers: { CooKie: 'mycookie=jar; other=val' } })
			).toEqual([cookieRoute, cookieValueRoute]);
			expect(request('/')).toEqual([]);
		});

		test('query', () => {
			const queryRoute = {
				src: '/',
				has: [{ type: 'query', key: 'param' }],
				continue: true,
			};
			const queryValueRoute = {
				src: '/',
				has: [{ type: 'query', key: 'param', value: 'value' }],
				continue: true,
			};
			const routes = [queryRoute, queryValueRoute];

			const request = (...args: Parameters<typeof requestGenerator>) =>
				routesMatcher({ request: requestGenerator(...args) }, routes);

			expect(request('/?param=foo&other=val')).toEqual([queryRoute]);
			expect(request('/?other=val&param=value')).toEqual([
				queryRoute,
				queryValueRoute,
			]);
			expect(request('/')).toEqual([]);
		});

		test('multi has', () => {
			const multipleHasRoute = {
				src: '/',
				has: [
					{ type: 'header', key: 'x-header', value: 'foo' },
					{ type: 'query', key: 'param' },
				],
				continue: true,
			};
			const routes = [multipleHasRoute];

			const request = (...args: Parameters<typeof requestGenerator>) =>
				routesMatcher({ request: requestGenerator(...args) }, routes);

			expect(request('/?param=foo&other=val')).toEqual([]);
			expect(
				request('/?other=val', { headers: { 'x-header': 'foo' } })
			).toEqual([]);
			expect(
				request('/?param=foo&other=val', { headers: { 'x-header': 'foo' } })
			).toEqual([multipleHasRoute]);
		});
	});

	describe('missing', () => {
		test('host', () => {
			const hostRoute = {
				src: '/',
				missing: [{ type: 'host', value: 'example.com' }],
				continue: true,
			};
			const otherHostRoute = {
				src: '/',
				missing: [{ type: 'host', value: 'fakehost' }],
				continue: true,
			};
			const routes = [hostRoute, otherHostRoute];

			const request = (...args: Parameters<typeof requestGenerator>) =>
				routesMatcher({ request: requestGenerator(...args) }, routes);

			expect(request('https://example.com/')).toEqual([otherHostRoute]);
			expect(request('https://fakehost/')).toEqual([hostRoute]);
			expect(request('https://foobar/')).toEqual([hostRoute, otherHostRoute]);
		});

		test('header', () => {
			const headerRoute = {
				src: '/',
				missing: [{ type: 'header', key: 'x-header' }],
				continue: true,
			};
			const headerValueRoute = {
				src: '/',
				missing: [{ type: 'header', key: 'x-header', value: 'foo' }],
				continue: true,
			};
			const routes = [headerRoute, headerValueRoute];

			const request = (...args: Parameters<typeof requestGenerator>) =>
				routesMatcher({ request: requestGenerator(...args) }, routes);

			expect(request('/', { headers: { 'X-HEADER': 'bar' } })).toEqual([
				headerValueRoute,
			]);
			expect(request('/', { headers: { 'X-Header': 'foo' } })).toEqual([]);
			expect(request('/')).toEqual([headerRoute, headerValueRoute]);
		});

		test('cookie', () => {
			const cookieRoute = {
				src: '/',
				missing: [{ type: 'cookie', key: 'mycookie' }],
				continue: true,
			};
			const cookieValueRoute = {
				src: '/',
				missing: [{ type: 'cookie', key: 'mycookie', value: 'jar' }],
				continue: true,
			};
			const routes = [cookieRoute, cookieValueRoute];

			const request = (...args: Parameters<typeof requestGenerator>) =>
				routesMatcher({ request: requestGenerator(...args) }, routes);

			expect(
				request('/', { headers: { Cookie: 'mycookie=foo; other=val' } })
			).toEqual([cookieValueRoute]);
			expect(
				request('/', { headers: { CooKie: 'mycookie=jar; other=val' } })
			).toEqual([]);
			expect(request('/')).toEqual([cookieRoute, cookieValueRoute]);
		});

		test('query', () => {
			const queryRoute = {
				src: '/',
				missing: [{ type: 'query', key: 'param' }],
				continue: true,
			};
			const queryValueRoute = {
				src: '/',
				missing: [{ type: 'query', key: 'param', value: 'value' }],
				continue: true,
			};
			const routes = [queryRoute, queryValueRoute];

			const request = (...args: Parameters<typeof requestGenerator>) =>
				routesMatcher({ request: requestGenerator(...args) }, routes);

			expect(request('/?param=foo&other=val')).toEqual([queryValueRoute]);
			expect(request('/?other=val&param=value')).toEqual([]);
			expect(request('/')).toEqual([queryRoute, queryValueRoute]);
		});

		test('multi missing', () => {
			const multipleMissingRoute = {
				src: '/',
				missing: [
					{ type: 'header', key: 'x-header', value: 'foo' },
					{ type: 'query', key: 'param' },
				],
				continue: true,
			};
			const routes = [multipleMissingRoute];

			const request = (...args: Parameters<typeof requestGenerator>) =>
				routesMatcher({ request: requestGenerator(...args) }, routes);

			expect(request('/?param=foo&other=val')).toEqual([]);
			expect(
				request('/?other=val', { headers: { 'x-header': 'foo' } })
			).toEqual([]);
			expect(
				request('/?param=foo&other=val', { headers: { 'x-header': 'foo' } })
			).toEqual([]);
			expect(
				request('/other=val', { headers: { 'other-header': 'bar' } })
			).toEqual([multipleMissingRoute]);
		});
	});

	test.skip('continue', () => {
		const continueRoute = {
			src: '/',
			continue: true,
		};
		const dontContinueRoute = {
			src: '/',
		};
		const terminalRoute = {
			src: '/',
		};
		const routes = [continueRoute, dontContinueRoute, terminalRoute];

		const request = (...args: Parameters<typeof requestGenerator>) =>
			routesMatcher({ request: requestGenerator(...args) }, routes);

		expect(request('/')).toEqual([continueRoute, dontContinueRoute]);
	});
});
