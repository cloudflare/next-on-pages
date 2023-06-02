import type { TestSet } from '../../_helpers';
import { createValidFuncDir } from '../../_helpers';

// root-level catch-all, and dynamic route.

const rawVercelConfig: VercelConfig = {
	version: 3,
	routes: [
		{
			src: '^(?:/((?:[^/]+?)(?:/(?:[^/]+?))*))/$',
			headers: { Location: '/$1' },
			status: 308,
			continue: true,
		},
		{
			src: '/_next/__private/trace',
			dest: '/404',
			status: 404,
			continue: true,
		},
		{
			src: '/404/?',
			status: 404,
			continue: true,
			missing: [{ type: 'header', key: 'x-prerender-revalidate' }],
		},
		{ src: '/500', status: 500, continue: true },
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
		{ src: '/_next/data/(.*)', dest: '/_next/data/$1', check: true },
		{ handle: 'resource' },
		{ src: '/.*', status: 404 },
		{ handle: 'miss' },
		{
			src: '/_next/static/(?:[^/]+/pages|pages|chunks|runtime|css|image|media)/.+',
			status: 404,
			check: true,
			dest: '$0',
		},
		{ handle: 'rewrite' },
		{ src: '/_next/data/KrEKu7sTpLxBoWS8AxVhX/index.json', dest: '/index' },
		{ src: '/_next/data/(.*)', dest: '/404', status: 404 },
		{ handle: 'hit' },
		{
			src: '/_next/static/(?:[^/]+/pages|pages|chunks|runtime|css|image|media|pPZC8ZomP\\-LGaTgP5LwTo)/.+',
			headers: { 'cache-control': 'public,max-age=31536000,immutable' },
			continue: true,
			important: true,
		},
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
			'index.func': createValidFuncDir('/index'),
			'index.rsc.func': createValidFuncDir('/index.rsc'),
			'alternative.func': createValidFuncDir('/alternative'),
			'alternative.rsc.func': createValidFuncDir('/alternative.rsc'),
		},
		static: {
			_next: {
				__private: { trace: 'trace file' },
				static: { chunks: { '123.js': 'chunk file' } },
				data: { 'file.json': 'data file' },
			},
			'404.html': '<html>404</html>',
			'500.html': '<html>500</html>',
			'favicon.ico': 'favicon ico',
		},
	},
	testCases: [
		...['/invalid-route', '/404', '/_next/__private/trace'].map(path => {
			return {
				name: `\`${path}\` returns the 404 error page`,
				paths: [path],
				expected: {
					status: 404,
					data: '<html>404</html>',
					headers: {
						'content-type': 'text/html; charset=utf-8',
						'x-matched-path': '/404',
					},
				},
			};
		}),
		...['/', '/index', '/index.rsc', '/api/hello'].map(path => {
			const fileName = path.replace(/^\/$/, '/index');
			const matchedPath = path.replace(/^\/index$/, '/');

			return {
				name: `\`${path}\` returns its page`,
				paths: [path],
				expected: {
					status: 200,
					data: JSON.stringify({
						file: fileName.replace(/\.rsc$/, ''),
						params: [],
					}),
					headers: {
						'content-type': 'text/plain;charset=UTF-8',
						'x-matched-path': matchedPath,
					},
				},
			};
		}),
		{
			name: '`/` with RSC header returns the page for `/index` and `vary` header',
			paths: ['/'],
			headers: { rsc: 'true' },
			expected: {
				status: 200,
				data: JSON.stringify({ file: '/index', params: [] }),
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/index.rsc',
					vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
				},
			},
		},
		{
			name: '`/500` returns the 500 error page',
			paths: ['/500'],
			expected: {
				status: 500,
				data: '<html>500</html>',
				headers: {
					'content-type': 'text/html; charset=utf-8',
					'x-matched-path': '/500',
				},
			},
		},
		{
			name: 'trailing slash redirects (308) to non-trailing slash',
			paths: ['/api/hello/'],
			expected: { status: 308, data: '', headers: { location: '/api/hello' } },
		},
		{
			name: 'valid `_next/static` file returns the cache headers',
			paths: ['/_next/static/chunks/123.js'],
			expected: {
				status: 200,
				data: 'chunk file',
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/_next/static/chunks/123.js',
					'cache-control': 'public,max-age=31536000,immutable',
				},
			},
		},
		{
			name: 'invalid `_next/static` file returns 404 and cache headers',
			paths: ['/_next/static/chunks/invalid-file'],
			expected: {
				status: 404,
				data: '<html>404</html>',
				headers: {
					'cache-control': 'public,max-age=31536000,immutable',
					'content-type': 'text/html; charset=utf-8',
					'x-matched-path': '/404',
				},
			},
		},
		{
			name: 'valid `_next/data` file matches correctly',
			paths: ['/_next/data/file.json'],
			expected: {
				status: 200,
				data: 'data file',
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/_next/data/file.json',
				},
			},
		},
		{
			name: 'invalid `_next/data` file returns 404',
			paths: ['/_next/data/invalid-file'],
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
			// `/_next/data/.../page.json` files get rewritten to the same path in `filesystem` phase.
			// This test ensures that the `rewrite` phase is entered when `check` is true, so that they
			// are rewritten correctly to `/page`. Otherwise, the page won't match correctly (issue #70).
			name: 'issue 70 - `rewrite` phase should enter after `filesystem` rewrites a path to the same path with `check: true`',
			paths: ['/_next/data/KrEKu7sTpLxBoWS8AxVhX/index.json'],
			expected: {
				status: 200,
				data: JSON.stringify({ file: '/index', params: [] }),
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/',
				},
			},
		},
		{
			name: "non-index page with trailing slash and rsc header doesn't redirect to /index",
			paths: ['/alternative/'],
			headers: { rsc: '1' },
			expected: {
				status: 200,
				data: JSON.stringify({ file: '/alternative', params: [] }),
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/alternative.rsc',
					vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
				},
			},
		},
	],
};
