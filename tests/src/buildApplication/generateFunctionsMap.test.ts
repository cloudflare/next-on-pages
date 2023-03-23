import { describe, test, expect, vi } from 'vitest';
import { generateFunctionsMap } from '../../../src/buildApplication/generateFunctionsMap';

vi.mock('node:fs/promises', async () => {
	return {
		readFile: async (file: string) => {
			if (/invalidTest\/functions\/index.*\/\.vc-config\.json/.test(file)) {
				return JSON.stringify({ runtime: 'nodejs', entrypoint: '' });
			}
			if (/validTest\/functions\/.*\/\.vc-config\.json/.test(file)) {
				return JSON.stringify({ runtime: 'edge', entrypoint: '' });
			}
			return '';
		},
		mkdir: async () => null,
		writeFile: async () => null,
		stat: async () => ({ isDirectory: () => true }),
		readdir: async (dir: string) => {
			if (['validTest/functions', 'invalidTest/functions'].includes(dir)) {
				return ['api', 'index.func', 'index.rsc.func'];
			}
			if (
				['validTest/functions/api', 'invalidTest/functions/api'].includes(dir)
			) {
				return ['hello.func'];
			}
			return [];
		},
	};
});

describe('generateFunctionsMap', async () => {
	test('should generate a valid functions map (without experimentalMinify)', async () => {
		const { invalidFunctions, functionsMap } = await generateFunctionsMap(
			'validTest/functions',
			false
		);
		expect(invalidFunctions.size).toEqual(0);
		expect(functionsMap.size).toEqual(3);
		expect(functionsMap.get('index')).toMatch(/\/index.func.js$/);
		expect(functionsMap.get('index.rsc')).toMatch(/\/index.rsc.func.js$/);
		expect(functionsMap.get('api/hello')).toMatch(/\/api\/hello.func.js$/);
	});

	// TODO: add tests that also test the functions map with the experimentalMinify flag

	test('should return invalid functions', async () => {
		const { invalidFunctions } = await generateFunctionsMap(
			'invalidTest/functions',
			false
		);
		expect(Array.from(invalidFunctions.values())).toEqual([
			'index.func',
			'index.rsc.func',
		]);
	});
});
