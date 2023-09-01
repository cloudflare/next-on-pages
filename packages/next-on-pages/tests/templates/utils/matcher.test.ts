import { describe, test, expect } from 'vitest';
import { parse } from 'cookie';
import { hasField } from '../../../templates/_worker.js/utils';

type HasFieldTestCase = {
	name: string;
	has: VercelHasField;
	dest?: string;
	expected: { valid: boolean; newRouteDest?: string };
};

const req = new Request(
	'https://test.com/index?queryWithValue=value&queryWithoutValue=&name=john',
	{
		headers: {
			headerWithValue: 'value',
			headerWithoutValue: undefined as unknown as string,
			cookie: 'cookieWithValue=value; cookieWithoutValue=',
		},
	},
);
const url = new URL(req.url);
const cookies = parse(req.headers.get('cookie') ?? '');

describe('hasField', () => {
	const testCases: HasFieldTestCase[] = [
		{
			name: 'host: valid host returns true',
			has: { type: 'host', value: 'test.com' },
			expected: { valid: true },
		},
		{
			name: 'host: invalid host returns false',
			has: { type: 'host', value: 'test2.com' },
			expected: { valid: false },
		},
		{
			name: 'header: has with key+value match returns true',
			has: { type: 'header', key: 'headerWithValue', value: 'value' },
			expected: { valid: true },
		},
		{
			name: 'header: has with key+value mismatch returns false',
			has: { type: 'header', key: 'headerWithValue', value: 'value2' },
			expected: { valid: false },
		},
		{
			name: 'header: has with key match returns true',
			has: { type: 'header', key: 'headerWithoutValue' },
			expected: { valid: true },
		},
		{
			name: 'header: has with key but no value mismatch returns false',
			has: { type: 'header', key: 'headerWithoutValue', value: 'value' },
			expected: { valid: false },
		},
		{
			name: 'cookie: has with key+value match returns true',
			has: { type: 'cookie', key: 'cookieWithValue', value: 'value' },
			expected: { valid: true },
		},
		{
			name: 'cookie: has with key+value mismatch returns false',
			has: { type: 'cookie', key: 'cookieWithValue', value: 'alt-value' },
			expected: { valid: false },
		},
		{
			name: 'cookie: has with key match returns true',
			has: { type: 'cookie', key: 'cookieWithValue' },
			expected: { valid: true },
		},
		{
			name: 'query: has with key+value match returns true',
			has: { type: 'query', key: 'queryWithValue', value: 'value' },
			expected: { valid: true },
		},
		{
			name: 'query: has with key+value mismatch returns false',
			has: { type: 'query', key: 'queryWithValue', value: 'alt-value' },
			expected: { valid: false },
		},
		{
			name: 'query: has with key match returns true',
			has: { type: 'query', key: 'queryWithoutValue' },
			expected: { valid: true },
		},
		{
			name: 'query: has with key but no value mismatch returns false',
			has: { type: 'query', key: 'queryWithoutValue', value: 'value' },
			expected: { valid: false },
		},
		{
			name: 'query: has with named capture returns a new dest on match',
			has: { type: 'query', key: 'name', value: '(?<name>.*)' },
			dest: '/test/$name',
			expected: { valid: true, newRouteDest: '/test/john' },
		},
		{
			name: 'query: has with named capture does not update missing named captures in dest',
			has: { type: 'query', key: 'name', value: '(?<name>.*)' },
			dest: '/test/$name/$age',
			expected: { valid: true, newRouteDest: '/test/john/$age' },
		},
		{
			name: 'query: has with named capture return valid on match when key is not in dest',
			has: { type: 'query', key: 'name', value: '(?<name>.*)' },
			dest: '/test/$age',
			expected: { valid: true, newRouteDest: '/test/$age' },
		},
		{
			name: 'query: has with named capture does not return dest on no matches',
			has: { type: 'query', key: 'invalidKey', value: '(?<name>.*)' },
			dest: '/test/$name',
			expected: { valid: false, newRouteDest: undefined },
		},
	];

	testCases.forEach(testCase => {
		test(testCase.name, () => {
			const result = hasField(testCase.has, {
				url,
				cookies,
				headers: req.headers,
				routeDest: testCase.dest,
			});
			expect(result).toEqual(testCase.expected);
		});
	});
});
