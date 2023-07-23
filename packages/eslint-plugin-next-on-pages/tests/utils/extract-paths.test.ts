import { describe, expect, test } from 'vitest';
import { extractPaths } from '../../src/utils/extract-paths';

describe('splitPaths', () => {
	test('should return an empty array if the input is empty', () => {
		expect(extractPaths('')).toEqual([]);
	});

	test(`should return an empty array if the input doesn't present any '/' character`, () => {
		expect(extractPaths('abc')).toEqual([]);
	});

	test(`should return a one-element array if the input contains a single '/' character`, () => {
		expect(extractPaths('a/b')).toEqual(['a']);
	});

	test(`should return a two-elements array if the input contains a two '/' characters`, () => {
		expect(extractPaths('a/b/c')).toEqual(['a', 'a/b']);
	});

	test(`should return a three-elements array if the input contains a three '/' characters`, () => {
		expect(extractPaths('a/b/c/d')).toEqual(['a', 'a/b', 'a/b/c']);
	});
});
