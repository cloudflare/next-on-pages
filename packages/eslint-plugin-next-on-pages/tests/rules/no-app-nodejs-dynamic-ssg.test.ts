import { RuleTester } from 'eslint';

import rule from '../../src/rules/no-app-nodejs-dynamic-ssg';
import { describe, test } from 'vitest';

const tester = new RuleTester({
	parser: require.resolve('@typescript-eslint/parser'),
});

const error = {
	message:
		'`generateStaticParams` cannot be used without opting in to the edge runtime or opting out from the Dynamic segment handling',
};

describe('no-app-nodejs-dynamic-ssg', () => {
	test('should work with a standard page', () => {
		tester.run('', rule, {
			valid: [
				{
					filename: '/app/dynamic/[...slug]/page.tsx',
					code: `
                    export const runtime = 'edge';

                    export async function generateStaticParams() {
                        return ["a", "b", "c"].map((char) => ({ slug: char }));
                    }

                    export default function Page({params: { slug }}) {
                        return <div>{slug}</div>;
                    }
                    `,
				},
				{
					filename: '/app/dynamic/[...slug]/page.tsx',
					code: `
                    export async function generateStaticParams() {
                        return ["a", "b", "c"].map((char) => ({ slug: char }));
                    }

                    export default function Page({params: { slug }}) {
                        return <div>{slug}</div>;
                    }

                    export const dynamicParams = false;
                    `,
				},
				{
					filename: '/app/dynamic/[...slug]/page.tsx',
					code: `
                    export const dynamicParams = false;

                    export async function generateStaticParams() {
                        return ["a", "b", "c"].map((char) => ({ slug: char }));
                    }

                    export default function Page({params: { slug }}) {
                        return <div>{slug}</div>;
                    }
                    `,
				},
			],
			invalid: [
				{
					filename: '/app/dynamic/[...slug]/page.tsx',
					code: `
                    export async function generateStaticParams() {
                        return ["a", "b", "c"].map((char) => ({ slug: char }));
                    }

                    export default function Page({params: { slug }}) {
                        return <div>{slug}</div>;
                    }
                    `,
					errors: [error],
				},
				{
					filename: '/app/dynamic/[...slug]/page.tsx',
					code: `
                    export async function generateStaticParams() {
                        return ["a", "b", "c"].map((char) => ({ slug: char }));
                    }

                    export default function Page({params: { slug }}) {
                        return <div>{slug}</div>;
                    }

                    export const dynamicParams = true;
                    `,
					errors: [error],
				},
			],
		});
	});

	test('should work on both js and ts files', () => {
		tester.run('', rule, {
			valid: [],
			invalid: [
				{
					filename: '/app/dynamic/[...slug]/page.tsx',
					code: `
                    export async function generateStaticParams() {
                        return ["a", "b", "c"].map((char) => ({ slug: char }));
                    }

                    export default function Page({params: { slug }}) {
                        return <div>{slug}</div>;
                    }
                    `,
					errors: [error],
				},
				{
					filename: '/app/dynamic/[...slug]/page.jsx',
					code: `
                    export async function generateStaticParams() {
                        return ["a", "b", "c"].map((char) => ({ slug: char }));
                    }

                    export default function Page({params: { slug }}) {
                        return <div>{slug}</div>;
                    }
                    `,
					errors: [error],
				},
			],
		});
	});

	test('should not consider commented out exports as real exports', () => {
		tester.run('', rule, {
			valid: [],
			invalid: [
				{
					filename: '/app/dynamic/[...slug]/page.tsx',
					code: `
                    // export const runtime = 'edge';

                    export async function generateStaticParams() {
                        return ["a", "b", "c"].map((char) => ({ slug: char }));
                    }

                    export default function Page({params: { slug }}) {
                        return <div>{slug}</div>;
                    }

                    // export const dynamicParams = false;
                    `,
					errors: [error],
				},
			],
		});
	});

	test('should not consider exports only similar to the real ones', () => {
		tester.run('', rule, {
			valid: [],
			invalid: [
				{
					filename: '/app/dynamic/[...slug]/page.tsx',
					code: `
                    export const runtimeToUse = 'edge';

                    export async function generateStaticParams() {
                        return ["a", "b", "c"].map((char) => ({ slug: char }));
                    }

                    export default function Page({params: { slug }}) {
                        return <div>{slug}</div>;
                    }
                    `,
					errors: [error],
				},
				{
					filename: '/app/dynamic/[...slug]/page.tsx',
					code: `
                    export async function generateStaticParams() {
                        return ["a", "b", "c"].map((char) => ({ slug: char }));
                    }

                    export default function Page({params: { slug }}) {
                        return <div>{slug}</div>;
                    }

                    export const dynamicParam = false;
                    `,
					errors: [error],
				},
				{
					filename: '/app/dynamic/[...slug]/page.tsx',
					code: `
                    export const runTime = 'edge';

                    export async function generateStaticParams() {
                        return ["a", "b", "c"].map((char) => ({ slug: char }));
                    }

                    export default function Page({params: { slug }}) {
                        return <div>{slug}</div>;
                    }

                    export const myDynamicParams = false;
                    `,
					errors: [error],
				},
			],
		});
	});

	test('should work with let variables (instead of const)', () => {
		tester.run('', rule, {
			valid: [
				{
					filename: '/app/dynamic/[...slug]/page.tsx',
					code: `
                    export let runtime = 'edge';

                    export async function generateStaticParams() {
                        return ["a", "b", "c"].map((char) => ({ slug: char }));
                    }

                    export default function Page({params: { slug }}) {
                        return <div>{slug}</div>;
                    }
                    `,
				},
			],
			invalid: [],
		});
	});

	test('should work with a standard page inside /src/app', () => {
		tester.run('', rule, {
			valid: [
				{
					filename: 'src/app/dynamic/[...slug]/page.tsx',
					code: `
                    export const runtime = 'edge';

                    export async function generateStaticParams() {
                        return ["a", "b", "c"].map((char) => ({ slug: char }));
                    }

                    export default function Page({params: { slug }}) {
                        return <div>{slug}</div>;
                    }
                    `,
				},
			],
			invalid: [
				{
					filename: '/src/app/dynamic/[...slug]/page.tsx',
					code: `
                    export async function generateStaticParams() {
                        return ["a", "b", "c"].map((char) => ({ slug: char }));
                    }

                    export default function Page({params: { slug }}) {
                        return <div>{slug}</div>;
                    }
                    `,
					errors: [error],
				},
			],
		});
	});

	test('should not apply in a non-page (utility) file in the app router', () => {
		tester.run('', rule, {
			valid: [
				{
					filename: '/app/utils/ssg.ts',
					code: `
                    export async function generateStaticParams() {
                        return ["a", "b", "c"].map((char) => ({ slug: char }));
                    }
                    `,
				},
			],
			invalid: [
				{
					filename: '/src/app/dynamic/[...slug]/page.tsx',
					code: `
                    export async function generateStaticParams() {
                        return ["a", "b", "c"].map((char) => ({ slug: char }));
                    }

                    export default function Page({params: { slug }}) {
                        return <div>{slug}</div>;
                    }
                    `,
					errors: [error],
				},
			],
		});
	});

	test('should not apply in files outside the app router', () => {
		tester.run('', rule, {
			valid: [
				{
					filename: '/pages/my-page/page.tsx',
					code: `
                    export async function generateStaticParams() {
                        return ["a", "b", "c"].map((char) => ({ slug: char }));
                    }
                    `,
				},
			],
			invalid: [
				{
					filename: '/src/app/dynamic/[...slug]/page.tsx',
					code: `
                    export async function generateStaticParams() {
                        return ["a", "b", "c"].map((char) => ({ slug: char }));
                    }

                    export default function Page({params: { slug }}) {
                        return <div>{slug}</div>;
                    }
                    `,
					errors: [error],
				},
			],
		});
	});
});
