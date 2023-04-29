import { describe, test, expect } from 'vitest';
import { hasField, checkRouteMatch } from '../../../templates/_worker.js/utils';
import { parse } from 'cookie';

type HasFieldTestCase = {
	name: string;
	has: VercelHasFields[0];
	expected: boolean;
};
const hasFieldTestCases: HasFieldTestCase[] = [
	{
		name: 'host: valid host returns true',
		has: { type: 'host', value: 'test.com' },
		expected: true,
	},
	{
		name: 'host: invalid host returns false',
		has: { type: 'host', value: 'test2.com' },
		expected: false,
	},
	{
		name: 'header: has with key+value match returns true',
		has: { type: 'header', key: 'headerWithValue', value: 'value' },
		expected: true,
	},
	{
		name: 'header: has with key+value mismatch returns false',
		has: { type: 'header', key: 'headerWithValue', value: 'value2' },
		expected: false,
	},
	{
		name: 'header: has with key match returns true',
		has: { type: 'header', key: 'headerWithoutValue' },
		expected: true,
	},
	{
		name: 'cookie: has with key+value match returns true',
		has: { type: 'cookie', key: 'foo', value: 'bar' },
		expected: true,
	},
	{
		name: 'cookie: has with key+value mismatch returns false',
		has: { type: 'cookie', key: 'foo', value: 'bar2' },
		expected: false,
	},
	{
		name: 'cookie: has with key match returns true',
		has: { type: 'cookie', key: 'bar' },
		expected: true,
	},
	{
		name: 'query: has with key+value match returns true',
		has: { type: 'query', key: 'foo', value: 'bar' },
		expected: true,
	},
	{
		name: 'query: has with key+value mismatch returns false',
		has: { type: 'query', key: 'foo', value: 'bar2' },
		expected: false,
	},
	{
		name: 'query: has with key match returns true',
		has: { type: 'query', key: 'bar' },
		expected: true,
	},
];

type CheckRouteMatchTestCase = {
	name: string;
	route: VercelSource;
	requiredStatus?: number;
	expected: boolean;
};
const checkRouteMatchTestCases: CheckRouteMatchTestCase[] = [
	{
		name: 'matches a route with only `src`',
		route: { src: '^/index$' },
		expected: true,
	},
	{
		name: 'doesnt match a route with invalid `src`',
		route: { src: '^/invalid$' },
		expected: false,
	},
	{
		name: 'matches a route with `src` and single `has`',
		route: { src: '^/index$', has: [{ type: 'host', value: 'test.com' }] },
		expected: true,
	},
	{
		name: 'matches a route with `src` and multiple `has`',
		route: {
			src: '^/index$',
			has: [
				{ type: 'host', value: 'test.com' },
				{ type: 'header', key: 'headerWithoutValue' },
				{ type: 'query', key: 'foo', value: 'bar' },
			],
		},
		expected: true,
	},
	{
		name: 'matches a route with `src` and `missing`',
		route: {
			src: '^/index$',
			missing: [{ type: 'host', value: 'example.com' }],
		},
		expected: true,
	},
	{
		name: 'doesnt match a route with `src` and invalid `missing`',
		route: {
			src: '^/index$',
			missing: [{ type: 'host', value: 'test.com' }],
		},
		expected: false,
	},
	{
		name: 'match with `src` and multiple `missing`',
		route: {
			src: '^/index$',
			missing: [
				{ type: 'host', value: 'example.com' },
				{ type: 'query', key: 'baz' },
			],
		},
		expected: true,
	},
	{
		name: 'doesnt match with `src` and multiple `missing` (one valid, one invalid)',
		route: {
			src: '^/index$',
			missing: [
				{ type: 'host', value: 'example.com' },
				{ type: 'query', key: 'foo' },
			],
		},
		expected: false,
	},
	{
		name: 'match with `src` and `has` and `missing`',
		route: {
			src: '^/index$',
			has: [{ type: 'host', value: 'test.com' }],
			missing: [{ type: 'host', value: 'example.com' }],
		},
		expected: true,
	},
	{
		name: 'match with `status` and required status',
		route: { src: '^/index$', status: 404 },
		requiredStatus: 404,
		expected: true,
	},
	{
		name: 'doesnt match with invalid `status` and required status',
		route: { src: '^/index$', status: 500 },
		requiredStatus: 404,
		expected: false,
	},
	{
		name: 'match with `src` + `has` + `missing` + `methods`',
		route: {
			src: '^/index$',
			has: [{ type: 'host', value: 'test.com' }],
			missing: [{ type: 'query', key: 'baz' }],
			methods: ['GET'],
			status: 500,
		},
		expected: true,
	},
];

const req = new Request('https://test.com/index?foo=bar&bar=', {
	headers: {
		headerWithValue: 'value',
		headerWithoutValue: undefined as unknown as string,
		cookie: 'foo=bar; bar=',
	},
});
const url = new URL(req.url);
const cookies = parse(req.headers.get('cookie') ?? '');

describe('hasField', () => {
	hasFieldTestCases.forEach(testCase => {
		test(testCase.name, () => {
			const result = hasField(testCase.has, {
				url,
				cookies,
				headers: req.headers,
			});
			expect(result).toEqual(testCase.expected);
		});
	});
});

describe('checkRouteMatch', () => {
	checkRouteMatchTestCases.forEach(testCase => {
		test(testCase.name, () => {
			const result = checkRouteMatch(testCase.route, url.pathname, {
				url,
				cookies,
				headers: req.headers,
				method: req.method,
				requiredStatus: testCase.requiredStatus,
			});
			expect(!!result).toEqual(testCase.expected);
		});
	});
});
