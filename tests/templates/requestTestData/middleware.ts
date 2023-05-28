import type { TestSet } from '../../_helpers';
import { createValidFuncDir } from '../../_helpers';

// routes using middleware: redirect, rewrite, set headers, set cookies, override request headers, return new NextResponse.

const rawVercelConfig: VercelConfig = {
	version: 3,
	routes: [
		{
			src: '^\\/api(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?[\\/#\\?]?$',
			middlewareRawSrc: ['/api/:path*'],
			middlewarePath: 'middleware',
			continue: true,
			override: true,
		},
		{ handle: 'resource' },
		{ src: '/.*', status: 404 },
		{ handle: 'hit' },
		{
			src: '/_next/static/(?:[^/]+/pages|pages|chunks|runtime|css|image|media|UKJR9Wnx2L\\-xs2sLbT6xH)/.+',
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
	name: 'routes using middleware',
	config: rawVercelConfig,
	files: {
		functions: {
			api: { 'hello.func': createValidFuncDir('/api/hello') },
			'some-page.func': createValidFuncDir('/some-page'),
			'somewhere-else.func': createValidFuncDir('/somewhere-else'),
			'middleware.func': createValidFuncDir('/api/hello'),
		},
		static: {
			'404.html': '<html>404</html>',
			'500.html': '<html>500</html>',
		},
	},
	testCases: [
		...['/some-page', '/somewhere-else'].map(path => ({
			name: 'non-middleware route functions normally',
			paths: [path],
			expected: {
				status: 200,
				data: JSON.stringify({ file: path, params: [] }),
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': path,
				},
			},
		})),
		{
			name: 'middleware route applies next header for `NextResponse.next()`',
			paths: ['/api/hello?next'],
			expected: {
				status: 200,
				data: JSON.stringify({ file: '/api/hello', params: [['next', '']] }),
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/api/hello',
				},
			},
		},
		{
			name: 'middleware route returns redirect for `NextResponse.redirect()`',
			paths: ['/api/hello?redirect'],
			expected: {
				status: 307,
				data: '',
				headers: {
					location: 'http://localhost/somewhere-else?redirect=',
				},
			},
		},
		{
			name: 'middleware route applies rewrite for `NextResponse.rewrite()`',
			paths: ['/api/hello?rewrite'],
			expected: {
				status: 200,
				data: JSON.stringify({ file: '/some-page', params: [['rewrite', '']] }),
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/some-page',
				},
			},
		},
		{
			name: 'middleware route applies headers + cookie',
			paths: ['/api/hello'],
			expected: {
				status: 200,
				data: JSON.stringify({ file: '/api/hello', params: [] }),
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/api/hello',
					'set-cookie': 'x-hello-from-middleware2=hello; Path=/',
					'x-hello-from-middleware2': 'hello',
				},
			},
		},
		{
			name: 'middleware route applies request headers and overrides where specified',
			paths: ['/api/hello?setHeader'],
			headers: {
				'not-overriden': 'should not be overriden',
				'overriden-header': 'should be overrided',
			},
			expected: {
				status: 200,
				data: JSON.stringify({
					file: '/api/hello',
					params: [['setHeader', '']],
				}),
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/api/hello',
					'set-cookie': 'x-hello-from-middleware2=hello; Path=/',
					'x-hello-from-middleware2': 'hello',
				},
				reqHeaders: {
					'not-overriden': 'should not be overriden',
					'overriden-header': 'overriden in middleware',
					'x-new-header': 'added in middleware',
				},
			},
		},
		{
			name: 'middleware route return 500 page for uncaught errors',
			paths: ['/api/hello?throw'],
			expected: {
				status: 500,
				data: '<html>500</html>',
				headers: {
					'content-type': 'text/html; charset=utf-8',
					'x-matched-path': '/500',
				},
				mockConsole: { error: [new Error('Middleware error')] },
			},
		},
		{
			name: 'middleware route returns custom response when returning a new NextResponse',
			paths: ['/api/hello?returns'],
			expected: {
				status: 401,
				data: '<html>Hello from middleware</html>',
				headers: {
					'content-type': 'text/html',
				},
			},
		},
	],
};
