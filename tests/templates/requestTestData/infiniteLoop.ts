import type { TestSet } from '../../_helpers';
import { createValidFuncDir } from '../../_helpers';

// runaway phase checking, aka infinitely looping through phases.

const rawVercelConfig: VercelConfig = {
	version: 3,
	routes: [
		{ src: '^/invalid$', dest: '/invalid/new', status: 404 },
		{ handle: 'filesystem' },
		{ src: '^/infinite$', dest: '/infinite/new' },
		{ handle: 'miss' },
		{ src: '^/invalid/new$', dest: '/invalid', check: true },
		{ src: '^/infinite/new$', dest: '/infinite', check: true },
		{ handle: 'hit' },
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
	name: 'infinite loop during route matching',
	config: rawVercelConfig,
	files: {
		functions: { api: { 'hello.func': createValidFuncDir('/api/hello') } },
		static: { '404.html': '<html>404</html>', '500.html': '<html>500</html>' },
	},
	testCases: [
		{
			name: 'regular route is processed normally',
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
			name: 'invalid asset with contradicting `miss` and `none` returns 404',
			paths: ['/invalid'],
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
			name: 'infinite phase checking returns 500 and logs an error',
			paths: ['/infinite'],
			expected: {
				status: 500,
				data: '<html>500</html>',
				mockConsole: {
					error: [
						'Routing encountered an infinite loop while checking /infinite',
					],
				},
				headers: {
					'content-type': 'text/html; charset=utf-8',
					'x-matched-path': '/500',
				},
			},
		},
	],
};
