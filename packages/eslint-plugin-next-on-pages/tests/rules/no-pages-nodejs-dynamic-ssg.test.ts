import { RuleTester } from 'eslint';

import rule from '../../src/rules/no-pages-nodejs-dynamic-ssg';
import { describe, test } from 'vitest';

const tester = new RuleTester({
	parser: require.resolve('@typescript-eslint/parser'),
});

const error = {
	message:
		'`getStaticPaths` cannot set `fallback` to anything but `false` without opting in to the edge runtime',
};

describe('no-pages-nodejs-dynamic-ssg', () => {
	test('should work with a standard page', () => {
		tester.run('', rule, {
			valid: [
				{
					filename: '/pages/ssg/[slug].jsx',
					code: `
					export async function getStaticPaths() {
						return {
							paths: ["a", "b", "c"].map(slug => ({ params: { slug } })),
							fallback: false
						};
					}

					export async function getStaticProps({ params: { slug } }) {
						return { props: { slug } };
					}

					export default function Page({ slug }) {
						return <div>{slug}</div>;
					}
					`,
				},
				{
					filename: '/pages/ssg/[slug].jsx',
					code: `
					export async function getStaticPaths() {
						return {
							paths: ["a", "b", "c"].map(slug => ({ params: { slug } })),
							fallback: true
						};
					}

					export const runtime = 'experimental-edge';

					export async function getStaticProps({ params: { slug } }) {
						return { props: { slug } };
					}
					
					export default function Page({ slug }) {
						return <div>{slug}</div>;
					}
					`,
				},
				{
					filename: '/pages/ssg/[slug].jsx',
					code: `
					export async function getStaticPaths() {
						return {
							paths: ["a", "b", "c"].map(slug => ({ params: { slug } })),
							fallback: true
						};
					}

					export const config = {
						runtime: 'experimental-edge',
					};

					export async function getStaticProps({ params: { slug } }) {
						return { props: { slug } };
					}

					export default function Page({ slug }) {
						return <div>{slug}</div>;
					}
					`,
				},
			],
			invalid: [
				{
					filename: '/pages/ssg/[slug].jsx',
					code: `
					export async function getStaticPaths() {
						return {
							paths: ["a", "b", "c"].map(slug => ({ params: { slug } })),
							fallback: true
						};
					}

					export async function getStaticProps({ params: { slug } }) {
						return { props: { slug } };
					}

					export default function Page({ slug }) {
						return <div>{slug}</div>;
					}
					`,
					errors: [error],
				},
				{
					filename: '/pages/ssg/[slug].jsx',
					code: `
					export async function getStaticPaths() {
						return {
							paths: ["a", "b", "c"].map(slug => ({ params: { slug } })),
							fallback: 'blocking'
						};
					}

					export async function getStaticProps({ params: { slug } }) {
						return { props: { slug } };
					}

					export default function Page({ slug }) {
						return <div>{slug}</div>;
					}
					`,
					errors: [error],
				},
				{
					filename: '/pages/ssg/[slug].jsx',
					code: `
					export async function getStaticPaths() {
						const paths = ["a", "b", "c"].map(slug => ({ params: { slug } }));
						const getStaticPathsResult =  {
							paths,
						};
						return {
							...getStaticPathsResult,
							fallback: true
						};
					}

					export async function getStaticProps({ params: { slug } }) {
						return { props: { slug } };
					}

					export default function Page({ slug }) {
						return <div>{slug}</div>;
					}
					`,
					errors: [error],
				},
			],
		});
	});

	test('should work when an intermediate variable is used for the `getStaticPaths` result', () => {
		tester.run('', rule, {
			valid: [],
			invalid: [
				{
					filename: '/pages/ssg/[slug].jsx',
					code: `
					export async function getStaticPaths() {
						const paths = ["a", "b", "c"].map(slug => ({ params: { slug } }));
						const getStaticPathsResult =  {
							paths,
							fallback: 'blocking',
						};
						return getStaticPathsResult;
					}

					export async function getStaticProps({ params: { slug } }) {
						return { props: { slug } };
					}

					export default function Page({ slug }) {
						return <div>{slug}</div>;
					}
					`,
					errors: [error],
				},
			],
		});
	});
});
