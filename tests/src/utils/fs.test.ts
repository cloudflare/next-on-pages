import { describe, test, expect } from 'vitest';
import {
	normalizePath,
	readJsonFile,
	validatePathType,
} from '../../../src/utils';

describe('normalizePath', () => {
	test('windows short path name format normalizes', () => {
		const path = 'D:\\very short path';
		const expected = 'D:/very short path';

		expect(normalizePath(path)).toEqual(expected);
	});

	test('unix path name format normalizes (no change)', () => {
		const path = '/home/unix/path';

		expect(normalizePath(path)).toEqual(path);
	});

	test('windows long path name format should not normalize', () => {
		const path = '\\\\?\\D:\\very long path';

		expect(normalizePath(path)).toEqual(path);
	});
});

describe('readJsonFile', () => {
	test('should read a valid JSON file', async () => {
		await expect(
			readJsonFile('validTest/functions/index.func/.vc-config.json')
		).resolves.toEqual({ runtime: 'edge', entrypoint: 'index.js' });
	});

	test('should return null with invalid json file', async () => {
		await expect(
			readJsonFile('invalidTest/functions/test/.invalid-config.json')
		).resolves.toEqual(null);
	});
});

describe('validatePathType', () => {
	describe('`file` type', () => {
		test('valid file returns true', async () => {
			await expect(
				validatePathType('validTest/functions/index.func/index.js', 'file')
			).resolves.toEqual(true);
		});

		test('valid directory returns false', async () => {
			await expect(
				validatePathType('validTest/functions/index.func/index.js', 'directory')
			).resolves.toEqual(false);
		});

		test('invalid path returns false', async () => {
			await expect(
				validatePathType('invalidTest/invalidPath', 'file')
			).resolves.toEqual(false);
		});
	});

	describe('`directory` type', () => {
		test('valid directory returns true', async () => {
			await expect(
				validatePathType('validTest/functions/index.func', 'directory')
			).resolves.toEqual(true);
		});

		test('valid file returns false', async () => {
			await expect(
				validatePathType('validTest/functions/index.func/index.js', 'directory')
			).resolves.toEqual(false);
		});

		test('invalid path returns false', async () => {
			await expect(
				validatePathType('invalidTest/invalidPath', 'directory')
			).resolves.toEqual(false);
		});
	});
});
