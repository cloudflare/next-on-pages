import { RuleTester } from 'eslint';

import rule from '../../src/rules/no-nodejs-runtime';
import { describe, test } from 'vitest';

const tester = new RuleTester({
	parser: require.resolve('@typescript-eslint/parser'),
});

describe('no-nodejs-runtime', () => {
	test('should work', () => {
		tester.run('no-nodejs-runtime', rule, {
			valid: [
				{ code: `export const runtime = 'edge';` },
				{ code: `export const runtime = 'edge';` },
			],
			invalid: [
				{
					code: `export const runtime = 'nodejs';`,
					errors: [
						{
							message:
								"The 'nodejs' runtime is not supported. Use 'edge' instead.",
							column: "export const runtime = '".length,
							endColumn:
								"export const runtime = '".length + "nodejs'".length + 1,
							suggestions: [],
						},
					],
					output: "export const runtime = 'edge';",
				},
			],
		});
	});
});
