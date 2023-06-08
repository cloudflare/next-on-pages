import { RuleTester } from 'eslint';

import rule from '../../src/rules/missing-image-loader';
import { describe, test } from 'vitest';

const tester = new RuleTester({
	parser: require.resolve('@typescript-eslint/parser'),
	parserOptions: { ecmaFeatures: { jsx: true } },
});

describe('no-nodejs-runtime', () => {
	test('should work with a standard Image import', () => {
		const getCode = (withLoader: boolean) => `
      import Image from 'next/image'

      <Image
        ${withLoader ? 'loader={myLoader}' : ''}
        src="/my-img.png"
        alt="My Image"
      />
    `;
		tester.run('', rule, {
			valid: [{ code: getCode(true) }],
			invalid: [
				{
					code: getCode(false),
					errors: [
						{
							message: 'No custom loader specified for the Image element.',
						},
					],
				},
			],
		});
	});

	test('should work with a renamed Image import', () => {
		const getCode = (withLoader: boolean) => `
      import * as NextImg from 'next/image'

      <NextImg
        ${withLoader ? 'loader={myLoader}' : ''}
        src="/my-img.png"
        alt="My Image"
      />
    `;
		tester.run('', rule, {
			valid: [{ code: getCode(true) }],
			invalid: [
				{
					code: getCode(false),
					errors: [
						{
							message: 'No custom loader specified for the Image element.',
						},
					],
				},
			],
		});
	});
});
