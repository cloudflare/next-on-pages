import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';
import {
	normalizePath,
	readJsonFile,
	validateDir,
	validateFile,
} from '../../../src/utils';

beforeAll(() => {
	vi.mock('node:fs/promises', () => ({
		stat: (path: string) =>
			new Promise((res, rej) =>
				path.startsWith('validTest')
					? res({
							isDirectory: () => !path.endsWith('.js'),
							isFile: () => path.endsWith('.js'),
					  })
					: rej('invalid path')
			),
		readFile: (path: string) =>
			new Promise((res, rej) =>
				path === '.vc-config.json'
					? res(JSON.stringify({ runtime: 'edge', entrypoint: 'index.js' }))
					: rej('invalid file')
			),
	}));
});

afterAll(() => {
	vi.clearAllMocks();
});

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
		await expect(readJsonFile('.vc-config.json')).resolves.toEqual({
			runtime: 'edge',
			entrypoint: 'index.js',
		});
	});

	test('should return null with invalid json file', async () => {
		await expect(readJsonFile('.invalid-config.json')).resolves.toEqual(null);
	});
});

describe('validateFile', () => {
	test('valid file returns true', async () => {
		await expect(
			validateFile('validTest/functions/index.func/index.js')
		).resolves.toEqual(true);
	});

	test('valid directory returns false', async () => {
		await expect(
			validateFile('validTest/functions/index.func')
		).resolves.toEqual(false);
	});

	test('invalid path returns false', async () => {
		await expect(validateFile('invalidTest/invalidPath')).resolves.toEqual(
			false
		);
	});
});

describe('validateDir', () => {
	test('valid directory returns true', async () => {
		await expect(
			validateDir('validTest/functions/index.func')
		).resolves.toEqual(true);
	});

	test('valid file returns false', async () => {
		await expect(
			validateDir('validTest/functions/index.func/index.js')
		).resolves.toEqual(false);
	});

	test('invalid path returns false', async () => {
		await expect(validateDir('invalidTest/invalidPath')).resolves.toEqual(
			false
		);
	});
});
