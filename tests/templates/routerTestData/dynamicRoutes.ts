import type { TestSet } from '../../_helpers';
import { createValidFuncDir } from '../../_helpers';

// root-level catch-all, and dynamic route.

const rawVercelConfig: VercelConfig = {
	version: 3,
	routes: [
		{
			src: '^/((?!_next/)(?:.*[^/]|.*))/?$',
			has: [{ type: 'header', key: 'x-nextjs-data' }],
			dest: '/_next/data/iJgI1dhNzKWmpXhfhPItf/$1.json',
			continue: true,
			override: true,
		},
		{
			src: '^/redirect/(?<paramWithValue>[^/]+?)/param(?:/)?$',
			headers: {
				location: '/redirect/with/param?paramWithValue=$paramWithValue',
			},
		},
		{ handle: 'rewrite' },
		{
			src: '^/_next/data/iJgI1dhNzKWmpXhfhPItf/dynamic/(?<pageId>[^/]+?)(?:/)?.json$',
			dest: '/dynamic/[pageId]?pageId=$pageId',
		},
		{
			src: '^/dynamic/(?<pageId>[^/]+?)(?:/)?$',
			dest: '/dynamic/[pageId]?pageId=$pageId',
		},
		{
			src: '^(?:/(?<nextParamIndex>.+?))?(?:/)?$',
			dest: '/[[...index]]?nextParamIndex=$nextParamIndex',
		},
		{ handle: 'resource' },
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
	name: 'dynamic routes',
	config: rawVercelConfig,
	files: {
		functions: {
			api: { 'hello.func': createValidFuncDir('/api/hello') },
			'[[...index]].func': createValidFuncDir('/[[...index]]'),
			dynamic: { '[pageId].func': createValidFuncDir('/dynamic/[pageId]') },
		},
		static: {
			'404.html': '<html>404</html>',
			'500.html': '<html>500</html>',
			'favicon.ico': 'favicon ico',
		},
	},
	testCases: [
		{
			name: 'does not catch defined routes (`/api/hello`)',
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
			name: 'catches non-defined routes in defined folder',
			paths: ['/api/test'],
			expected: {
				status: 200,
				data: JSON.stringify({
					file: '/[[...index]]',
					params: [['nextParamIndex', 'api/test']],
				}),
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/[[...index]]',
				},
			},
		},
		{
			name: 'catches non-defined routes',
			paths: ['/test'],
			expected: {
				status: 200,
				data: JSON.stringify({
					file: '/[[...index]]',
					params: [['nextParamIndex', 'test']],
				}),
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/[[...index]]',
				},
			},
		},
		{
			name: 'non-catchall dynamic route (`/dynamic/[pageId]`)',
			paths: ['/dynamic/test'],
			expected: {
				status: 200,
				data: JSON.stringify({
					file: '/dynamic/[pageId]',
					params: [['pageId', 'test']],
				}),
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/dynamic/[pageId]',
				},
			},
		},
		{
			name: 'non-catchall dynamic route matched with `x-nextjs-data` header (`/dynamic/[pageId]`)',
			paths: ['/dynamic/test'],
			headers: { 'x-nextjs-data': 'test' },
			expected: {
				status: 200,
				data: JSON.stringify({
					file: '/dynamic/[pageId]',
					params: [['pageId', 'test']],
				}),
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/dynamic/[pageId]',
				},
			},
		},
		{
			name: 'redirects include search params from match',
			paths: ['/redirect/value/param'],
			expected: {
				status: 307,
				data: '',
				headers: { location: '/redirect/with/param?paramWithValue=value' },
			},
		},
	],
};
