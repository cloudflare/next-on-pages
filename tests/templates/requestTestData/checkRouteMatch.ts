import type { TestSet } from '../../_helpers';
import { createValidFuncDir } from '../../_helpers';

// root-level catch-all, and dynamic route.

const rawVercelConfig: VercelConfig = {
	version: 3,
	routes: [
		{ src: '^/valid-src-only$', dest: '/' },
		{
			src: '^/valid-src-and-has$',
			dest: '/',
			has: [{ type: 'host', value: 'test.com' }],
		},
		{
			src: '^/valid-src-and-multiple-has$',
			dest: '/',
			has: [
				{ type: 'host', value: 'test.com' },
				{ type: 'header', key: 'headerWithoutValue' },
				{ type: 'query', key: 'queryWithValue', value: 'value' },
			],
		},
		{
			src: '^/valid-src-and-missing$',
			dest: '/',
			missing: [{ type: 'host', value: 'example.com' }],
		},
		{
			src: '^/valid-src-and-multiple-missing$',
			dest: '/',
			missing: [
				{ type: 'host', value: 'example.com' },
				{ type: 'query', key: 'queryWithValue' },
			],
		},
		{
			src: '^/valid-src-and-has-and-missing$',
			dest: '/',
			has: [{ type: 'host', value: 'test.com' }],
			missing: [{ type: 'host', value: 'example.com' }],
		},
		{
			src: '^/valid-src-and-has-and-missing-and-methods$',
			dest: '/',
			has: [{ type: 'host', value: 'test.com' }],
			missing: [{ type: 'query', key: 'missingQuery' }],
			methods: ['GET'],
		},
		{
			src: '^/valid-src-and-method$',
			dest: '/',
			methods: ['GET'],
		},
		{ handle: 'miss' },
		{ src: '.*', dest: '/404', status: 404 },
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
			'index.func': createValidFuncDir('/index'),
		},
		static: {
			'404.html': '<html>404</html>',
			'500.html': '<html>500</html>',
		},
	},
	testCases: [
		{
			name: 'matches a route with only `src`',
			paths: ['/valid-src-only'],
			expected: {
				status: 200,
				data: JSON.stringify({ file: '/index', params: [] }),
				headers: { 'content-type': 'text/plain;charset=UTF-8' },
			},
		},
		{
			name: "doesn't match a route with invalid `src`",
			paths: ['/invalid-src-only'],
			expected: {
				status: 404,
				data: '<html>404</html>',
				headers: { 'content-type': 'text/html; charset=utf-8' },
			},
		},
		{
			name: 'matches a route with `src` and single `has`',
			paths: ['/valid-src-and-has'],
			host: 'test.com',
			expected: {
				status: 200,
				data: JSON.stringify({ file: '/index', params: [] }),
				headers: { 'content-type': 'text/plain;charset=UTF-8' },
			},
		},
		{
			name: 'matches a route with `src` and multiple `has`',
			paths: ['/valid-src-and-multiple-has?queryWithValue=value'],
			host: 'test.com',
			headers: { headerWithoutValue: '' },
			expected: {
				status: 200,
				data: JSON.stringify({
					file: '/index',
					params: [['queryWithValue', 'value']],
				}),
				headers: { 'content-type': 'text/plain;charset=UTF-8' },
			},
		},
		{
			name: 'matches a route with `src` and `missing`',
			paths: ['/valid-src-and-missing'],
			host: 'test.com',
			expected: {
				status: 200,
				data: JSON.stringify({ file: '/index', params: [] }),
				headers: { 'content-type': 'text/plain;charset=UTF-8' },
			},
		},
		{
			name: "doesn't match a route with `src` and invalid `missing`",
			paths: ['/valid-src-and-missing'],
			host: 'example.com',
			expected: {
				status: 404,
				data: '<html>404</html>',
				headers: { 'content-type': 'text/html; charset=utf-8' },
			},
		},
		{
			name: 'match with `src` and multiple `missing`',
			paths: ['/valid-src-and-multiple-missing'],
			host: 'test.com',
			expected: {
				status: 200,
				data: JSON.stringify({ file: '/index', params: [] }),
				headers: { 'content-type': 'text/plain;charset=UTF-8' },
			},
		},
		{
			name: "doesn't match with `src` and multiple `missing` (one valid, one invalid)",
			paths: ['/valid-src-and-missing?queryWithValue=value'],
			host: 'example.com',
			expected: {
				status: 404,
				data: '<html>404</html>',
				headers: { 'content-type': 'text/html; charset=utf-8' },
			},
		},
		{
			name: 'match with `src` and `has` and `missing`',
			paths: ['/valid-src-and-has-and-missing'],
			host: 'test.com',
			expected: {
				status: 200,
				data: JSON.stringify({ file: '/index', params: [] }),
				headers: { 'content-type': 'text/plain;charset=UTF-8' },
			},
		},
		{
			name: 'match with `src` + `has` + `missing` + `methods`',
			paths: ['/valid-src-and-has-and-missing-and-methods'],
			host: 'test.com',
			expected: {
				status: 200,
				data: JSON.stringify({ file: '/index', params: [] }),
				headers: { 'content-type': 'text/plain;charset=UTF-8' },
			},
		},
		{
			name: 'match with correct `method`',
			paths: ['/valid-src-and-method'],
			expected: {
				status: 200,
				data: JSON.stringify({ file: '/index', params: [] }),
				headers: { 'content-type': 'text/plain;charset=UTF-8' },
			},
		},
		{
			name: "doesn't match with incorrect `method`",
			paths: ['/valid-src-and-method'],
			method: 'POST',
			expected: {
				status: 404,
				data: '<html>404</html>',
				headers: { 'content-type': 'text/html; charset=utf-8' },
			},
		},
	],
};
