import type { TestSet } from '../../_helpers';
import { createPrerenderedRoute, createValidFuncDir } from '../../_helpers';

// statically generated app directory routes

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
		{ src: '/_next/data/(.*)', dest: '/404', status: 404 },
		{ handle: 'hit' },
		{
			src: '/_next/static/(?:[^/]+/pages|pages|chunks|runtime|css|image|media|jxqUo2MmZ0iXRvRlLtGY7)/.+',
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
	name: 'basic static app dir routes',
	config: rawVercelConfig,
	files: {
		functions: {
			api: { 'hello.func': createValidFuncDir('/api/hello') },
			...createPrerenderedRoute('index'),
			'non-dynamic': createPrerenderedRoute('slug', '/non-dynamic'),
			dynamic: {
				...createPrerenderedRoute('foo', '/dynamic'),
				...createPrerenderedRoute('bar', '/dynamic'),
				...createPrerenderedRoute('baz', '/dynamic'),
			},
		},
		static: {
			'404.html': '<html>404</html>',
			'500.html': '<html>500</html>',
			'favicon.ico': 'favicon ico',
		},
	},
	testCases: [
		...[
			'/',
			'/index',
			'/index.rsc',
			'/non-dynamic/slug',
			'/non-dynamic/slug.rsc',
			'/dynamic/foo',
			'/dynamic/foo.rsc',
			'/dynamic/bar',
			'/dynamic/bar.rsc',
			'/dynamic/baz',
			'/dynamic/baz.rsc',
		].map(path => {
			const fileName = path.replace(/^\/$/, '/index');
			const matchedPath = path.replace(/^\/index$/, '/');
			const isRsc = /\.rsc$/.test(path);

			return {
				name: `\`${path}\` returns its static ${isRsc ? 'RSC ' : ''}page`,
				paths: [path],
				expected: {
					status: 200,
					data: `${fileName}.prerender-fallback.${isRsc ? 'rsc' : 'html'}`,
					headers: {
						'content-type': isRsc
							? 'text/x-component'
							: 'text/plain;charset=UTF-8',
						'x-matched-path': matchedPath,
						vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
					},
				},
			};
		}),
		{
			name: '`/` with RSC header returns the RSC page for `/index` and `vary` header',
			paths: ['/'],
			headers: { rsc: 'true' },
			expected: {
				status: 200,
				data: '/index.rsc.prerender-fallback.rsc',
				headers: {
					'content-type': 'text/x-component',
					'x-matched-path': '/index.rsc',
					vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
				},
			},
		},
		{
			name: 'edge runtime `/api/hello` returns the correct page',
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
			name: 'invalid route + `/404` returns the 404 error page',
			paths: ['/invalid-route', '/404'],
			expected: {
				status: 404,
				data: '<html>404</html>',
				headers: {
					'content-type': 'text/html; charset=utf-8',
					'x-matched-path': '/404',
				},
			},
		},
	],
};
