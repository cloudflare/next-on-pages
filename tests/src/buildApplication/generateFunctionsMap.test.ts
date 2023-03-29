import { describe, test, expect } from 'vitest';
import { generateFunctionsMap } from '../../../src/buildApplication/generateFunctionsMap';

describe('generateFunctionsMap', async () => {
	test('should generate a valid functions map (without experimentalMinify)', async () => {
		const { invalidFunctions, functionsMap } = await generateFunctionsMap(
			'validTest/functions',
			false
		);
		expect(invalidFunctions.size).toEqual(0);
		expect(functionsMap.size).toEqual(3);
		expect(functionsMap.get('index')).toMatch(/\/index\.func\.js$/);
		expect(functionsMap.get('index.rsc')).toMatch(/\/index\.rsc\.func\.js$/);
		expect(functionsMap.get('api/hello')).toMatch(/\/api\/hello\.func\.js$/);
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
			'hello.func',
		]);
	});
});
