import type { TestSet } from '../../_helpers';
import { createValidFuncDir } from '../../_helpers';

// next.config.js internationalization (i18n); sub-path routing, and domain routing.

const rawVercelConfig: VercelConfig = {
	version: 3,
	routes: [
		{
			src: '^(?:/((?:[^/]+?)(?:/(?:[^/]+?))*))/$',
			headers: { Location: '/$1' },
			status: 308,
			continue: true,
		},
		{
			src: '/_next/__private/trace',
			dest: '/404',
			status: 404,
			continue: true,
		},
		{
			src: '^/(?!(?:_next/.*|en|fr|nl|es|de)(?:/.*|$))(.*)$',
			dest: '$wildcard/$1',
			continue: true,
		},
		{
			src: '^//?(?:en|fr|nl|es|de)?/?$',
			locale: {
				redirect: { es: 'https://example.es/' },
				cookie: 'NEXT_LOCALE',
			},
			continue: true,
		},
		{
			src: '/',
			locale: {
				redirect: { en: '/', fr: '/fr', nl: '/nl', es: '/es', de: '/de' },
				cookie: 'NEXT_LOCALE',
			},
			continue: true,
		},
		{ src: '^/$', dest: '/en', continue: true },
		{
			src: '^/(?!(?:_next/.*|en|fr|nl|es|de)(?:/.*|$))(.*)$',
			dest: '/en/$1',
			continue: true,
		},
		{
			src: '/(?:en|fr|nl|es|de)?[/]?404/?',
			status: 404,
			continue: true,
			missing: [{ type: 'header', key: 'x-prerender-revalidate' }],
		},
		{ src: '/(?:en|fr|nl|es|de)?[/]?500', status: 500, continue: true },
		{ handle: 'filesystem' },
		{ src: '/_next/data/(.*)', dest: '/_next/data/$1', check: true },
		{ handle: 'resource' },
		{ src: '/.*', status: 404 },
		{ handle: 'miss' },
		{
			src: '/_next/static/(?:[^/]+/pages|pages|chunks|runtime|css|image|media)/.+',
			status: 404,
			check: true,
			dest: '$0',
		},
		{ src: '/en', dest: '/', check: true },
		{ src: '^//?(?:en|fr|nl|es|de)/(.*)', dest: '/$1', check: true },
		{ handle: 'rewrite' },
		{
			src: '^/_next/data/_LMNvx1uNzgkLzYi9\\-YVv/(?<nextLocale>en|fr|nl|es|de)/gsp.json$',
			dest: '/$nextLocale/gsp',
		},
		{
			src: '^/_next/data/_LMNvx1uNzgkLzYi9\\-YVv/(?<nextLocale>en|fr|nl|es|de)/gsp/(?<nxtPslug>[^/]+?)\\.json$',
			dest: '/$nextLocale/gsp/[slug]?nxtPslug=$nxtPslug',
		},
		{
			src: '^/_next/data/_LMNvx1uNzgkLzYi9\\-YVv/(?<nextLocale>en|fr|nl|es|de)/gssp.json$',
			dest: '/$nextLocale/gssp',
		},
		{ src: '/_next/data/(.*)', dest: '/404', status: 404 },
		{
			src: '^[/]?(?<nextLocale>en|fr|nl|es|de)?/gsp/(?<nxtPslug>[^/]+?)(?:/)?$',
			dest: '/$nextLocale/gsp/[slug]?nxtPslug=$nxtPslug',
		},
		{ handle: 'hit' },
		{
			src: '/_next/static/(?:[^/]+/pages|pages|chunks|runtime|css|image|media|_LMNvx1uNzgkLzYi9\\-YVv)/.+',
			headers: { 'cache-control': 'public,max-age=31536000,immutable' },
			continue: true,
			important: true,
		},
		{
			src: '/index',
			headers: { 'x-matched-path': '/' },
			continue: true,
			important: true,
		},
		{
			src: '/((?!index$).*)',
			headers: { 'x-matched-path': '/$1' },
			continue: true,
			important: true,
		},
		{ handle: 'error' },
		{
			src: '/(?<nextLocale>en|fr|nl|es|de)(/.*|$)',
			dest: '/$nextLocale/404',
			status: 404,
			caseSensitive: true,
		},
		{ src: '/.*', dest: '/en/404', status: 404 },
		{
			src: '/(?<nextLocale>en|fr|nl|es|de)(/.*|$)',
			dest: '/$nextLocale/500',
			status: 500,
			caseSensitive: true,
		},
		{ src: '/.*', dest: '/en/500', status: 500 },
	],
	wildcard: [{ domain: 'example.es', value: '/es' }],
	overrides: {
		'en/gsp.html': { path: 'en/gsp', contentType: 'text/html; charset=utf-8' },
		'fr/gsp.html': { path: 'fr/gsp', contentType: 'text/html; charset=utf-8' },
		'nl/gsp.html': { path: 'nl/gsp', contentType: 'text/html; charset=utf-8' },
		'en.html': { path: 'en', contentType: 'text/html; charset=utf-8' },
		'en/404.html': { path: 'en/404', contentType: 'text/html; charset=utf-8' },
		'en/500.html': { path: 'en/500', contentType: 'text/html; charset=utf-8' },
		'fr.html': { path: 'fr', contentType: 'text/html; charset=utf-8' },
		'fr/404.html': { path: 'fr/404', contentType: 'text/html; charset=utf-8' },
		'fr/500.html': { path: 'fr/500', contentType: 'text/html; charset=utf-8' },
		'nl.html': { path: 'nl', contentType: 'text/html; charset=utf-8' },
		'nl/404.html': { path: 'nl/404', contentType: 'text/html; charset=utf-8' },
		'nl/500.html': { path: 'nl/500', contentType: 'text/html; charset=utf-8' },
		'es.html': { path: 'es', contentType: 'text/html; charset=utf-8' },
		'es/404.html': { path: 'es/404', contentType: 'text/html; charset=utf-8' },
		'es/500.html': { path: 'es/500', contentType: 'text/html; charset=utf-8' },
		'de/404.html': { path: 'de/404', contentType: 'text/html; charset=utf-8' },
		'de/500.html': { path: 'de/500', contentType: 'text/html; charset=utf-8' },
	},
};

const staticLocales = ['en', 'fr', 'nl', 'es'] as const;
const nonStaticLocales = ['de'] as const;
const locales = [...staticLocales, ...nonStaticLocales] as const;

export const testSet: TestSet = {
	name: 'routes using middleware',
	config: rawVercelConfig,
	files: {
		functions: {
			gsp: { '[slug].func': createValidFuncDir('/gsp/[slug]') },
			'gssp.func': createValidFuncDir('/gssp'),
			'index.func': createValidFuncDir('/index'),
		},
		static: {
			_next: {
				static: { chunks: { 'index.js': 'index chunk file' } },
				data: {
					'_LMNvx1uNzgkLzYi9-YVv': locales.reduce(
						(acc, locale) => ({
							...acc,
							[locale]: { 'gsp.json': JSON.stringify({ locale }) },
						}),
						{}
					),
				},
			},
			...locales.reduce(
				(acc, locale) => ({
					...acc,
					...(staticLocales.includes(locale as (typeof staticLocales)[number])
						? { [`${locale}.html`]: `<html>${locale}</html>` }
						: {}),
					[locale]: {
						'404.html': `<html>${locale}: 404</html>`,
						'500.html': `<html>${locale}: 500</html>`,
						'gsp.html': `<html>${locale}: gsp</html>`,
					},
				}),
				{}
			),
		},
	},
	testCases: [
		{
			name: 'returns 404 for missing asset instead of infinite loop',
			paths: ['/favicon.ico'],
			expected: {
				status: 404,
				data: '<html>en: 404</html>',
				headers: {
					'content-type': 'text/html; charset=utf-8',
					'x-matched-path': '/en/404',
				},
			},
		},
		{
			name: '/ matches default locale (en) page',
			paths: ['/'],
			expected: {
				status: 200,
				data: '<html>en</html>',
				headers: {
					'content-type': 'text/html; charset=utf-8',
					'x-matched-path': '/en',
				},
			},
		},
		...staticLocales.map(locale => {
			const path = `/${locale}`;
			return {
				name: `${path} matches ${path} static page for the correct locale`,
				paths: [path],
				expected: {
					status: 200,
					data: `<html>${locale}</html>`,
					headers: {
						'content-type': 'text/html; charset=utf-8',
						'x-matched-path': `${path}`,
					},
				},
			};
		}),
		...nonStaticLocales.map(locale => {
			const path = `/${locale}`;
			return {
				name: `${path} matches /index function as it is not statically generated`,
				paths: [path],
				expected: {
					status: 200,
					data: JSON.stringify({ file: '/index', params: [] }),
					headers: {
						'content-type': 'text/plain;charset=UTF-8',
						'x-matched-path': '/',
					},
				},
			};
		}),
		...locales.map(locale => ({
			name: `gets static locale (${locale}) page for generated \`_next/data\``,
			paths: [`/_next/data/_LMNvx1uNzgkLzYi9-YVv/${locale}/gsp.json`],
			expected: {
				status: 200,
				data: JSON.stringify({ locale }),
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': `/_next/data/_LMNvx1uNzgkLzYi9-YVv/${locale}/gsp.json`,
				},
			},
		})),
		{
			name: 'gets static file for valid `_next/static/...`',
			paths: ['/_next/static/chunks/index.js'],
			headers: { 'accept-language': 'fr' },
			expected: {
				status: 200,
				data: 'index chunk file',
				headers: {
					'cache-control': 'public,max-age=31536000,immutable',
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/_next/static/chunks/index.js',
				},
			},
		},
		{
			name: 'runs function for route (no specific locale for function)',
			paths: ['/gssp', ...locales.map(locale => `/${locale}/gssp`)],
			expected: {
				status: 200,
				data: JSON.stringify({ file: '/gssp', params: [] }),
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/gssp',
				},
			},
		},
		{
			name: 'runs function for dynamic route (no specific locale for function)',
			paths: ['/gsp/test', ...locales.map(locale => `/${locale}/gsp/test`)],
			expected: {
				status: 200,
				data: JSON.stringify({
					file: '/gsp/[slug]',
					params: [
						['nxtPslug', 'test'],
						['slug', 'test'],
					],
				}),
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
					'x-matched-path': '/gsp/[slug]',
				},
			},
		},
		{
			name: 'locale redirects to url with accept-language (es) header',
			paths: ['/', '/en', '/fr', '/nl', '/es'],
			headers: { 'accept-language': 'es' },
			expected: {
				status: 307,
				data: '',
				headers: { location: 'https://example.es/' },
			},
		},
		{
			name: 'locale redirects to url with cookie (es)',
			paths: ['/', '/en', '/fr', '/nl', '/es'],
			headers: { cookie: 'NEXT_LOCALE=es' },
			expected: {
				status: 307,
				data: '',
				headers: { location: 'https://example.es/' },
			},
		},
		{
			name: 'locale does not redirect with same accept-language (en) header',
			paths: ['/'],
			headers: { 'accept-language': 'en' },
			expected: {
				status: 200,
				data: '<html>en</html>',
				headers: {
					'content-type': 'text/html; charset=utf-8',
					'x-matched-path': '/en',
				},
			},
		},
		{
			name: 'locale does not redirect with same cookie (en)',
			paths: ['/'],
			headers: { cookie: 'NEXT_LOCALE=en' },
			expected: {
				status: 200,
				data: '<html>en</html>',
				headers: {
					'content-type': 'text/html; charset=utf-8',
					'x-matched-path': '/en',
				},
			},
		},
		{
			name: 'locale redirects to path with accept-language (fr) header',
			paths: ['/'],
			headers: { 'accept-language': 'fr' },
			expected: {
				status: 307,
				data: '',
				headers: { location: '/fr' },
			},
		},
		{
			name: 'locale redirects to path with cookie (fr)',
			paths: ['/'],
			headers: { cookie: 'NEXT_LOCALE=fr' },
			expected: {
				status: 307,
				data: '',
				headers: { location: '/fr' },
			},
		},
		{
			name: 'does not redirect when path starts with locale',
			paths: ['/fr'],
			expected: {
				status: 200,
				data: '<html>fr</html>',
				headers: {
					'content-type': 'text/html; charset=utf-8',
					'x-matched-path': '/fr',
				},
			},
		},
		{
			name: 'Vercel wildcard rewrites work: example.es -> /es',
			paths: ['/'],
			host: 'example.es',
			expected: {
				status: 200,
				data: '<html>es</html>',
				headers: {
					'content-type': 'text/html; charset=utf-8',
					'x-matched-path': '/es',
				},
			},
		},
	],
};
