import { describe, test, expect } from 'vitest';
import {
	MiddlewareManifest,
	parseMiddlewareManifest,
} from '../../../src/buildApplication/middlewareManifest';

describe('parseMiddlewareManifest', () => {
	[-1, 3, 'v4'].forEach(invalidVersion => {
		test(`should throw if the manifest version is not 2 (but is ${invalidVersion})`, () => {
			expect(() =>
				parseMiddlewareManifest(
					{ version: invalidVersion } as MiddlewareManifest,
					new Map()
				)
			).toThrow(
				`Unknown functions manifest version. Expected 2 but found ${invalidVersion}.`
			);
		});
	});

	test(`should not produce any function/middleware if none are present in the manifest`, () => {
		expect(
			parseMiddlewareManifest(
				{
					version: 2,
					middleware: {},
					functions: {},
				},
				new Map()
			)
		).deep.equals({
			hydratedMiddleware: new Map(),
			hydratedFunctions: new Map(),
		});
	});

	test('should produce appropriate hydratedFunctions', () => {
		const mockedManifest: MiddlewareManifest = {
			version: 2,
			middleware: {},
			functions: {
				'app/test/page': {
					name: 'app/test/page',
					matchers: [{ regexp: 'regexpA' }],
				},
				'app/[id]/page': {
					name: 'app/[id]/page',
					matchers: [{ regexp: 'regexpB' }],
				},
				'app/1/2/3/page': {
					name: 'app/1/2/3/page',
					matchers: [{ regexp: 'regexpC' }],
				},
				'app/page': { name: 'app/page', matchers: [{ regexp: 'regexpD' }] },
				'app/test/route': {
					name: 'app/test/route',
					matchers: [{ regexp: 'regexpE' }],
				},
				'pages/api/hello': {
					name: 'pages/api/hello',
					matchers: [{ regexp: 'regexpF' }],
				},
			},
		};

		const functionsMap = new Map(
			['test', '[id]', '1/2/3', 'index', 'test', 'api/hello'].map(fn => [
				fn,
				`test/filepath/${fn}`,
			])
		);

		const expectedHydratedFunction = new Map([
			[
				'test',
				{ filepath: 'test/filepath/test', matchers: [{ regexp: 'regexpA' }] },
			],
			[
				'[id]',
				{ filepath: 'test/filepath/[id]', matchers: [{ regexp: 'regexpB' }] },
			],
			[
				'1/2/3',
				{
					filepath: 'test/filepath/1/2/3',
					matchers: [{ regexp: 'regexpC' }],
				},
			],
			[
				'index',
				{
					filepath: 'test/filepath/index',
					matchers: [{ regexp: 'regexpD' }],
				},
			],
			[
				'test',
				{ filepath: 'test/filepath/test', matchers: [{ regexp: 'regexpE' }] },
			],
			[
				'api/hello',
				{
					filepath: 'test/filepath/api/hello',
					matchers: [{ regexp: 'regexpF' }],
				},
			],
		]);

		expect(parseMiddlewareManifest(mockedManifest, functionsMap)).deep.equals({
			hydratedMiddleware: new Map(),
			hydratedFunctions: expectedHydratedFunction,
		});
	});

	// TODO: add a 'should produce appropriate hydratedMiddleware' test similar to the hydratedFunctions one
});
