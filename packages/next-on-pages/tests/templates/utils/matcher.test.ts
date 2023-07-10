import { describe, test, expect } from 'vitest';
import { parse } from 'cookie';
import { hasField } from '../../../templates/_worker.js/utils';

type HasFieldTestCase = {
	name: string;
	has: VercelHasField;
	expected: boolean;
};

const req = new Request(
	'https://test.com/index?queryWithValue=value&queryWithoutValue=',
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
			name: 'header: has with key but no value mismatch returns false',
			has: { type: 'header', key: 'headerWithoutValue', value: 'value' },
			expected: false,
		},
		{
			name: 'cookie: has with key+value match returns true',
			has: { type: 'cookie', key: 'cookieWithValue', value: 'value' },
			expected: true,
		},
		{
			name: 'cookie: has with key+value mismatch returns false',
			has: { type: 'cookie', key: 'cookieWithValue', value: 'alt-value' },
			expected: false,
		},
		{
			name: 'cookie: has with key match returns true',
			has: { type: 'cookie', key: 'cookieWithValue' },
			expected: true,
		},
		{
			name: 'query: has with key+value match returns true',
			has: { type: 'query', key: 'queryWithValue', value: 'value' },
			expected: true,
		},
		{
			name: 'query: has with key+value mismatch returns false',
			has: { type: 'query', key: 'queryWithValue', value: 'alt-value' },
			expected: false,
		},
		{
			name: 'query: has with key match returns true',
			has: { type: 'query', key: 'queryWithoutValue' },
			expected: true,
		},
		{
			name: 'query: has with key but no value mismatch returns false',
			has: { type: 'query', key: 'queryWithoutValue', value: 'value' },
			expected: false,
		},
	];

	testCases.forEach(testCase => {
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
