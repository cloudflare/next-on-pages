import path from 'path';
import { RuleTester } from 'eslint';

import rule from '../../src/rules/no-app-not-found-runtime';
import { describe, test } from 'vitest';

const tester = new RuleTester({
	parser: require.resolve('@typescript-eslint/parser'),
});

const contextCwd = path.join(__dirname, '../..');

describe('no-app-not-found-runtime', () => {
	test('should work', () => {
		tester.run('no-app-not-found-runtime', rule, {
			valid: [
				{
					filename: path.join(contextCwd, '/app/not-found.tsx'),
					code: `
						export default function Page() {
							return 'Not Found';
						}
					`,
				},
				{
					filename: path.join(contextCwd, '/app/page.tsx'),
					code: `
						export const runtime = 'edge';
						export default function Page() {
							return 'Hello';
						}
						`,
				},
			],
			invalid: [
				{
					filename: path.join(contextCwd, '/app/not-found.tsx'),
					code: "export const runtime = 'edge';",
					errors: [
						{
							message: `Only static not-found pages are currently supported, please remove the runtime export in ${contextCwd}/app/not-found.tsx`,
						},
					],
					output: '',
				},
			],
		});
	});

	test('should work with src folder', () => {
		tester.run('no-app-not-found-runtime', rule, {
			valid: [
				{
					filename: path.join(contextCwd, '/src/app/not-found.tsx'),
					code: `
						export default function Page() {
							return 'Not Found';
						}
					`,
				},
			],
			invalid: [
				{
					filename: path.join(contextCwd, '/src/app/not-found.tsx'),
					code: "export const runtime = 'edge';",
					errors: [
						{
							message: `Only static not-found pages are currently supported, please remove the runtime export in ${contextCwd}/src/app/not-found.tsx`,
						},
					],
					output: '',
				},
			],
		});
	});
});
