import type { TestSet } from '../../_helpers';
import { createValidFuncDir } from '../../_helpers';

// next.config.js rewrites, redirects, and headers options

const rawVercelConfig: VercelConfig = {
	version: 3,
	routes: [
		{
			src: '^/(?:/)?$',
			headers: {
				'x-hello': 'world',
			},
			continue: true,
		},
		{
			src: '^(?!/_next)/about(?:/)?$',
			headers: {
				Location: '/home',
			},
			status: 307,
		},
		{
			src: '^(?!/_next)/about-permanent(?:/)?$',
			headers: {
				Location: '/home',
			},
			status: 308,
		},
		{
			src: '^/some-page(?:/)?$',
			dest: '/somewhere-else?overrideMe=$overrideMe',
			has: [
				{
					type: 'query',
					key: 'overrideMe',
				},
			],
			continue: true,
			override: true,
		},
		{
			src: '^/',
			has: [{ type: 'header', key: 'rsc' }],
			dest: '/index.rsc',
			headers: { vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch' },
			continue: true,
			override: true,
		},
		{
			src: '^/((?!.+\\.rsc).+?)(?:/)?$',
			has: [{ type: 'header', key: 'rsc' }],
			dest: '/$1.rsc',
			headers: { vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch' },
			continue: true,
			override: true,
		},
		{ handle: 'filesystem' },
		{ src: '^/non-existent(?:/)?$', dest: '/contact', check: true },
		{ handle: 'resource' },
		{
			src: '^(?:/((?:[^/]+?)(?:/(?:[^/]+?))*))?(?:/)?$',
			dest: 'https://my-old-site.com/$1',
			check: true,
		},
		{ src: '/.*', status: 404 },
		{ handle: 'hit' },
		{
			src: '/index',
			headers: {
				'x-matched-path': '/',
			},
			continue: true,
			important: true,
		},
		{
			src: '/((?!index$).*)',
			headers: {
				'x-matched-path': '/$1',
			},
			continue: true,
			important: true,
		},
		{ handle: 'error' },
		{ src: '/.*', dest: '/404', status: 404 },
		{ src: '/.*', dest: '/500', status: 500 },
	],
	overrides: {
		'404.html': { path: '404', contentType: 'text/html; charset=utf-8' },
		'500.html': { path: '500', contentType: 'text/html; charset=utf-8' },
	},
};

export const testSet: TestSet = {
	name: 'next.config.js rewrites/redirects/headers',
	config: rawVercelConfig,
	files: {
		functions: {
			api: { 'hello.func': createValidFuncDir('/api/hello') },
			'contact.func': createValidFuncDir('/contact'),
			'home.func': createValidFuncDir('/home'),
			'some-page.func': createValidFuncDir('/some-page'),
			'somewhere-else.func': createValidFuncDir('/somewhere-else'),
			'index.func': createValidFuncDir('/index'),
		},
		static: {
			'contact.rsc': '/contact.rsc asset',
			'somewhere-else.rsc': '/somewhere-else.rsc asset',
			'404.html': '<html>404</html>',
			'500.html': '<html>500</html>',
			'favicon.ico': 'favicon ico',
		},
	},
	testCases: [
		{
			name: 'route with no config options functions normally',
			paths: ['/api/hello'],
			expected: {
				status: 200,
				data: JSON.stringify({ file: '/api/hello', params: [] }),
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/api/hello',
				},
			},
		},
		{
			name: 'rewrites - `beforeFiles`: rewrites when the `overrideMe` param is present',
			paths: ['/some-page?overrideMe=hello'],
			expected: {
				status: 200,
				data: JSON.stringify({
					file: '/somewhere-else',
					params: [['overrideMe', 'hello']],
				}),
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/somewhere-else',
				},
			},
		},
		{
			name: 'rewrites - `beforeFiles`: does not rewrite when the `overrideMe` param is not present',
			paths: ['/some-page'],
			expected: {
				status: 200,
				data: JSON.stringify({ file: '/some-page', params: [] }),
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/some-page',
				},
			},
		},
		{
			name: 'rewrites - `afterFiles`: rewrites on path match',
			paths: ['/non-existent'],
			expected: {
				status: 200,
				data: JSON.stringify({ file: '/contact', params: [] }),
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/contact',
				},
			},
		},
		{
			name: 'rewrites - `fallback`: rewrites on any request that has not been matched',
			paths: ['/invalid-route'],
			expected: {
				status: 307,
				data: '',
				headers: { location: 'https://my-old-site.com/invalid-route' },
			},
		},
		{
			name: 'redirects: non-permanent redirect on path match',
			paths: ['/about'],
			expected: { status: 307, data: '', headers: { location: '/home' } },
		},
		{
			name: 'redirects: permanent redirect on path match',
			paths: ['/about-permanent'],
			expected: { status: 308, data: '', headers: { location: '/home' } },
		},
		{
			name: 'headers: applies header on path match',
			paths: ['/'],
			expected: {
				status: 200,
				data: JSON.stringify({ file: '/index', params: [] }),
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/',
					'x-hello': 'world',
				},
			},
		},
		{
			name: 'RSC: rewrites - `beforeFiles`: rewrites when the `overrideMe` param is present',
			paths: ['/some-page?overrideMe=hello'],
			headers: { RSC: '1' },
			expected: {
				status: 200,
				data: '/somewhere-else.rsc asset',
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/somewhere-else.rsc',
					vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
				},
			},
		},
		{
			name: 'RSC: rewrites - `afterFiles`: rewrites on path match',
			paths: ['/non-existent'],
			headers: { RSC: '1' },
			expected: {
				status: 200,
				data: '/contact.rsc asset',
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/contact.rsc',
					vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
				},
			},
		},
	],
};
