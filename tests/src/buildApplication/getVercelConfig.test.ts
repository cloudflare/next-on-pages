import { describe, test, expect } from 'vitest';
import {
	getPhaseRoutes,
	processVercelConfig,
} from '../../../src/buildApplication/getVercelConfig';

describe('processVercelConfig', () => {
	test('should process the handler phases correctly', () => {
		const inputtedConfig: VercelConfig = {
			version: 3,
			routes: [
				{ src: '/test-1', dest: '/test-2' },
				{ handle: 'filesystem' },
				{ src: '/test-3', dest: '/test-4' },
				{ handle: 'miss' },
				{ src: '/test-2', dest: '/test-6' },
			],
		};

		expect(processVercelConfig(inputtedConfig)).toEqual({
			version: 3,
			routes: {
				none: [{ src: '/test-1', dest: '/test-2' }],
				filesystem: [{ src: '/test-3', dest: '/test-4' }],
				miss: [{ src: '/test-2', dest: '/test-6' }],
				rewrite: [],
				resource: [],
				hit: [],
				error: [],
			},
		});
	});
});

describe('getPhaseRoutes', () => {
	test('return an empty array if there are no routes', () => {
		const routes: VercelRoute[] = [];
		const result = getPhaseRoutes(routes, 'none');
		const expected: VercelRoute[] = [];
		expect(result).toEqual(expected);
	});

	test('return an empty array if there are no routes in the specified phase', () => {
		const routes: VercelRoute[] = [
			{ src: '/test-A' },
			{ handle: 'filesystem' },
			{ src: '/test-B' },
			{ handle: 'miss' },
			{ src: '/test-C' },
		];

		const result = getPhaseRoutes(routes, 'rewrite');
		const expected: VercelRoute[] = [];
		expect(result).toEqual(expected);
	});

	test("return 'none' routes", () => {
		const routes: VercelRoute[] = [
			{ src: '/test-A' },
			{ src: '/test-B' },
			{ src: '/test-C' },
			{ handle: 'filesystem' },
			{ src: '/test-D' },
			{ src: '/test-E' },
			{ handle: 'miss' },
			{ src: '/test-F' },
		];

		const result = getPhaseRoutes(routes, 'none');
		const expected: VercelRoute[] = [
			{ src: '/test-A' },
			{ src: '/test-B' },
			{ src: '/test-C' },
		];

		expect(result).toEqual(expected);
	});

	test("return 'miss' routes", () => {
		const routes: VercelRoute[] = [
			{ src: '/test-A' },
			{ src: '/test-B' },
			{ src: '/test-C' },
			{ handle: 'filesystem' },
			{ src: '/test-D' },
			{ src: '/test-E' },
			{ handle: 'miss' },
			{ src: '/test-F' },
			{ src: '/test-G' },
			{ src: '/test-H' },
			{ handle: 'hit' },
			{ src: '/test-I' },
			{ src: '/test-J' },
		];

		const result = getPhaseRoutes(routes, 'miss');
		const expected: VercelRoute[] = [
			{ src: '/test-F' },
			{ src: '/test-G' },
			{ src: '/test-H' },
		];

		expect(result).toEqual(expected);
	});

	test("return 'miss' routes", () => {
		const routes: VercelRoute[] = [
			{ src: '/test-A' },
			{ handle: 'filesystem' },
			{ src: '/test-B' },
			{ handle: 'miss' },
			{ handle: 'rewrite' },
			{ handle: 'resource' },
			{ handle: 'hit' },
			{ src: '/test-C' },
			{ src: '/test-D' },
		];

		const result = getPhaseRoutes(routes, 'hit');
		const expected: VercelRoute[] = [{ src: '/test-C' }, { src: '/test-D' }];

		expect(result).toEqual(expected);
	});
});
