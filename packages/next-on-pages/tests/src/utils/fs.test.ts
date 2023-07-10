import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import {
	copyFileWithDir,
	normalizePath,
	readJsonFile,
	readPathsRecursively,
	validateDir,
	validateFile,
} from '../../../src/utils';
import mockFs from 'mock-fs';

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
		const vcConfigContent = {
			runtime: 'edge',
			entrypoint: 'index.js',
		};
		mockFs({
			'.vc-config.json': JSON.stringify(vcConfigContent),
		});
		await expect(readJsonFile('.vc-config.json')).resolves.toEqual(
			vcConfigContent,
		);
		mockFs.restore();
	});

	test('should return null with invalid json file', async () => {
		mockFs({
			'invalid.json': 'invalid-file',
		});
		await expect(readJsonFile('invalid.json')).resolves.toEqual(null);
		mockFs.restore();
	});
});

describe('validateFile', () => {
	beforeAll(() => {
		mockFs({
			'functions/index.func': { 'index.js': 'valid-file' },
		});
	});
	afterAll(() => {
		mockFs.restore();
	});
	test('valid file returns true', async () => {
		await expect(
			validateFile('functions/index.func/index.js'),
		).resolves.toEqual(true);
	});

	test('valid directory returns false', async () => {
		await expect(validateFile('functions/index.func')).resolves.toEqual(false);
	});

	test('invalid path returns false', async () => {
		await expect(
			validateFile('functions/invalid-index.func/index.js'),
		).resolves.toEqual(false);
	});
});

describe('validateDir', () => {
	beforeAll(() => {
		mockFs({
			'functions/index.func': { 'index.js': 'valid-file' },
		});
	});
	afterAll(() => {
		mockFs.restore();
	});
	test('valid directory returns true', async () => {
		mockFs({
			'functions/index.func': { 'index.js': 'valid-file' },
		});
		await expect(validateDir('functions/index.func')).resolves.toEqual(true);
		mockFs.restore();
	});

	test('valid file returns false', async () => {
		await expect(validateDir('functions/index.func/index.js')).resolves.toEqual(
			false,
		);
	});

	test('invalid path returns false', async () => {
		await expect(validateDir('invalidPath')).resolves.toEqual(false);
	});
});

describe('readPathsRecursively', () => {
	beforeAll(() => {
		mockFs({
			root: {
				functions: {
					'(route-group)': {
						'page.func': {
							'index.js': 'page-js-code',
						},
					},
					'index.func': {
						'index.js': 'index-js-code',
					},
					'home.func': {
						'index.js': 'home-js-code',
					},
				},
			},
		});
	});
	afterAll(() => {
		mockFs.restore();
	});
	test('should read all paths recursively', async () => {
		const paths = (await readPathsRecursively('root/functions')).map(path =>
			normalizePath(path),
		);
		expect(paths.length).toEqual(3);
		expect(paths[0]).toMatch(
			/root\/functions\/\(route-group\)\/page\.func\/index\.js$/,
		);
		expect(paths[1]).toMatch(/root\/functions\/home\.func\/index\.js$/);
		expect(paths[2]).toMatch(/root\/functions\/index\.func\/index\.js$/);
	});

	test('invalid directory, returns empty array', async () => {
		await expect(
			readPathsRecursively('invalid-root/functions'),
		).resolves.toEqual([]);
	});
});

describe('copyFileWithDir', () => {
	test('should copy file to missing directory', async () => {
		mockFs({
			folder: {
				'index.js': 'valid-file',
			},
		});

		await expect(validateDir('new-folder')).resolves.toEqual(false);
		await copyFileWithDir('folder/index.js', 'new-folder/index.js');
		await expect(validateFile('new-folder/index.js')).resolves.toEqual(true);

		mockFs.restore();
	});

	test('should copy file to existing directory', async () => {
		mockFs({
			folder: {
				'index.js': 'valid-file',
			},
			'new-folder': {},
		});

		await expect(validateDir('new-folder')).resolves.toEqual(true);
		await copyFileWithDir('folder/index.js', 'new-folder/index.js');
		await expect(validateFile('new-folder/index.js')).resolves.toEqual(true);

		mockFs.restore();
	});
});
