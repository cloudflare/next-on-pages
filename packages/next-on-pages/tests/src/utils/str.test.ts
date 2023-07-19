import { describe, expect, test } from 'vitest';
import { replaceLastSubstringInstance } from '../../../src/utils';

describe('replaceLastSubstringInstance', () => {
	test('should replace last instance of a string, in a string', () => {
		const input = 'one two one two';

		let newValue = replaceLastSubstringInstance(input, 'one', 'three');
		expect(newValue).toEqual('one two three two');

		newValue = replaceLastSubstringInstance(newValue, 'one', 'four');
		expect(newValue).toEqual('four two three two');
	});
});
