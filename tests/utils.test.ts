import { describe, test, expect } from 'vitest';
import { normalizePath } from '../src/utils';

describe('normalizePath', () => {
	test('windows long path name format should not normalize', () => {
		const path = '\\\\?\\D:\\very long path';

		expect(normalizePath(path)).toEqual(path);
	});

	test('windows short path name format normalizes', () => {
		const path = 'D:\\very short path';
		const expected = 'D:/very short path';

		expect(normalizePath(path)).toEqual(expected);
	});

	test('unix path name format normalizes (no change)', () => {
		const path = '/home/unix/path';

		expect(normalizePath(path)).toEqual(path);
	});
});
