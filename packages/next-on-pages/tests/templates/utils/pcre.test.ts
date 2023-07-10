import { describe, test, expect } from 'vitest';
import {
	matchPCRE,
	applyPCREMatches,
} from '../../../templates/_worker.js/utils';

type TestCase = {
	name: string;
	url: string;
	route: VercelSource;
	expected: { match: boolean; captureGroupKeys: string[]; newDest?: string };
};

describe('matchPCRE', () => {
	const testCases: TestCase[] = [
		{
			name: 'should match a basic route',
			url: 'https://example.com/index',
			route: { src: '^/index(?:/)?' },
			expected: { match: true, captureGroupKeys: [] },
		},
		{
			name: 'should not match with invalid case sensitive route',
			url: 'https://example.com/INDEX',
			route: { src: '^/index(?:/)?', caseSensitive: true },
			expected: { match: false, captureGroupKeys: [] },
		},
		{
			name: 'should match with valid case sensitive route',
			url: 'https://example.com/INDEX',
			route: { src: '^/INDEX(?:/)?', caseSensitive: true },
			expected: { match: true, captureGroupKeys: [] },
		},
		{
			name: 'should match when case sensitive is not set',
			url: 'https://example.com/index',
			route: { src: '^/INDEX(?:/)?' },
			expected: { match: true, captureGroupKeys: [] },
		},
		{
			name: 'should match with named capture groups',
			url: 'https://example.com/index',
			route: { src: '^/i(?<name>nde)x(?:/)?' },
			expected: { match: true, captureGroupKeys: ['name'] },
		},
	];

	testCases.forEach(testCase => {
		test(testCase.name, () => {
			const result = matchPCRE(
				testCase.route.src,
				new URL(testCase.url).pathname,
				testCase.route.caseSensitive,
			);
			expect({ ...result, match: !!result.match }).toEqual(testCase.expected);
		});
	});
});

describe('applyPCREMatches', () => {
	const testCases: TestCase[] = [
		{
			name: 'should process a dest for a basic route',
			url: 'https://example.com/index',
			route: { src: '^/index(?:/)?', dest: '/index.html' },
			expected: { match: true, captureGroupKeys: [], newDest: '/index.html' },
		},
		{
			name: 'should process a `$0` dest for a basic route',
			url: 'https://example.com/index',
			route: { src: '^/index(?:/)?', dest: '/new/$0/dest' },
			expected: {
				match: true,
				captureGroupKeys: [],
				newDest: '/new//index/dest',
			},
		},
		{
			name: 'should process a `$1` dest for a basic route',
			url: 'https://example.com/index',
			route: { src: '^/i(nde)x(?:/)?', dest: '/new/$1/dest' },
			expected: { match: true, captureGroupKeys: [], newDest: '/new/nde/dest' },
		},
		{
			name: 'should process dest for a route with named groups',
			url: 'https://example.com/index',
			route: { src: '^/i(?<name>nde)x(?:/)?', dest: '/new/$name/dest' },
			expected: {
				match: true,
				captureGroupKeys: ['name'],
				newDest: '/new/nde/dest',
			},
		},
		{
			name: 'should process dest for a route with multiple named groups',
			url: 'https://example.com/index/123',
			route: {
				src: '^/i(?<name>nde)x/(?<id>\\d+)(?:/)?',
				dest: '/new/$name/$id/dest',
			},
			expected: {
				match: true,
				captureGroupKeys: ['name', 'id'],
				newDest: '/new/nde/123/dest',
			},
		},
		{
			name: 'should process dest for route with named groups to query params',
			url: 'https://example.com/index/123',
			route: {
				src: '^/i(?<name>nde)x/(?<id>\\d+)(?:/)?',
				dest: '/new/$name/dest?id=$id',
			},
			expected: {
				match: true,
				captureGroupKeys: ['name', 'id'],
				newDest: '/new/nde/dest?id=123',
			},
		},
		{
			name: 'should process dest for route with missing query param in dest',
			url: 'https://example.com/index',
			route: { src: '^/i(?<name>nde)x(?:/)?', dest: '/new/$name/dest?id=$id' },
			expected: {
				match: true,
				captureGroupKeys: ['name'],
				newDest: '/new/nde/dest?id=',
			},
		},
	];

	testCases.forEach(testCase => {
		test(testCase.name, () => {
			const { match, captureGroupKeys } = matchPCRE(
				testCase.route.src,
				new URL(testCase.url).pathname,
				testCase.route.caseSensitive,
			);
			const result = applyPCREMatches(
				testCase.route.dest ?? '',
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				match!,
				captureGroupKeys,
			);

			const { newDest: expectedNewDest, ...expected } = testCase.expected;
			expect({ captureGroupKeys, match: !!match }).toEqual(expected);
			expect(result).toEqual(expectedNewDest);
		});
	});
});
