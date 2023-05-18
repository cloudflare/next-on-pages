import type { TestSet } from '../../_helpers';
import { mockPrerenderConfigFile } from '../../_helpers';
import { createValidFuncDir } from '../../_helpers';

// `trailingSlash` option in `next.config.js` is `true`.

const rawVercelConfig: VercelConfig = {
	version: 3,
	routes: [
		{
			src: '^(?:/((?!\\.well-known(?:/.*)?)(?:[^/]+/)*[^/]+\\.\\w+))/$',
			headers: { Location: '/$1' },
			status: 308,
			missing: [{ type: 'header', key: 'x-nextjs-data' }],
			continue: true,
		},
		{
			src: '^(?:/((?!\\.well-known(?:/.*)?)(?:[^/]+/)*[^/\\.]+))$',
			headers: { Location: '/$1/' },
			status: 308,
			continue: true,
		},
		{
			src: '/404/?',
			status: 404,
			continue: true,
			missing: [{ type: 'header', key: 'x-prerender-revalidate' }],
		},
		{ src: '/500', status: 500, continue: true },
		{ handle: 'resource' },
		{ src: '/.*', status: 404 },
		{ handle: 'rewrite' },
		{ src: '^/(?<lang>[^/]+?)(?:/)?$', dest: '/[lang]?lang=$lang' },
		{ handle: 'hit' },
		{
			src: '/index',
			headers: { 'x-matched-path': '/' },
			continue: true,
			important: true,
		},
		{
			src: '/((?!index$).*)',
			headers: { 'x-matched-path': '/$1' },
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
	name: 'basic edge runtime app dir routes',
	config: rawVercelConfig,
	files: {
		functions: {
			api: { 'hello.func': createValidFuncDir('/api/hello') },
			'[lang].func': createValidFuncDir('/[lang]'),
			'robots.txt.prerender-config.json': mockPrerenderConfigFile(
				'robots.txt',
				'body'
			),
			'robots.txt.prerender-fallback.body': 'robots.txt fallback',
		},
		static: {
			'404.html': '<html>404</html>',
			'500.html': '<html>500</html>',
		},
	},
	testCases: [
		{
			name: 'non-trailing slash redirects to trailing slash',
			paths: ['/en'],
			expected: {
				status: 308,
				data: '',
				headers: { location: '/en/' },
			},
		},
		{
			name: 'dynamic page with trailing slash matches',
			paths: ['/en/'],
			expected: {
				status: 200,
				data: JSON.stringify({ file: '/[lang]', params: [['lang', 'en']] }),
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/[lang]',
				},
			},
		},
		{
			name: 'non-trailing slash non-dynamic page redirects to trailing slash',
			paths: ['/api/hello'],
			expected: {
				status: 308,
				data: '',
				headers: {
					location: '/api/hello/',
				},
			},
		},
		{
			name: 'non-dynamic page with trailing slash matches',
			paths: ['/api/hello/'],
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
			name: 'invalid page 404s',
			paths: ['/invalid/route/'],
			expected: {
				status: 404,
				data: '<html>404</html>',
				headers: {
					'content-type': 'text/html; charset=utf-8',
					'x-matched-path': '/404',
				},
			},
		},
		{
			name: 'non-dynamic prerendered route matches',
			paths: ['/robots.txt'],
			expected: {
				status: 200,
				data: 'robots.txt fallback',
				headers: {
					'content-type': 'text/plain',
					'x-matched-path': '/robots.txt',
					vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
				},
			},
		},
	],
};
