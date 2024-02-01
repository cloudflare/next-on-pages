import { describe, it } from 'vitest';
import { getAssertVisible } from '@features-utils/getAssertVisible';

const pages = {
	index: {
		path: '/',
		pageName: 'Index',
	},
	getStaticProps: {
		path: '/get-static-props',
		pageName: 'getStaticProps',
	},
	getStaticPropsDynamic: {
		path: '/get-static-props/dynamic',
		pageName: 'getStaticProps (dynamic)',
	},
	getServerSideProps: {
		path: '/get-server-side-props',
		pageName: 'getServerSideProps',
	},
} as const;

describe('Pages next.config i18n', () => {
	Object.values(pages).forEach(({ path, pageName }) => {
		it(`should view the "${pageName}" page on the default locale`, async () => {
			const page = await BROWSER.newPage();
			const assertVisible = getAssertVisible(page);
			const assertLocaleInfo = getAssertLocaleInfo(assertVisible);

			await page.goto(`${DEPLOYMENT_URL}${path}`);

			await assertVisible('h1', { hasText: `${pageName} page` });

			await assertLocaleInfo('en');
		});

		(['en', 'es', 'fr', 'nl'] as const).forEach(locale => {
			it(`should view the "${pageName}" page on the "${locale}" locale`, async () => {
				const page = await BROWSER.newPage();
				const assertVisible = getAssertVisible(page);
				const assertLocaleInfo = getAssertLocaleInfo(assertVisible);

				await page.goto(`${DEPLOYMENT_URL}/${locale}${path}`);

				await assertVisible('h1', { hasText: `${pageName} page` });

				await assertLocaleInfo(locale);
			});
		});
	});

	(['en', 'es', 'fr', 'nl'] as const).forEach(locale => {
		it(`should respect the Accept-Language header (and use "${locale}")`, async () => {
			const ctx = await BROWSER.newContext();
			ctx.setExtraHTTPHeaders({
				'Accept-Language': `Unknown, ${locale};q=0.8, it_IT;q=0.5, *;q=0.2`,
			});
			const page = await ctx.newPage();

			const assertVisible = getAssertVisible(page);
			const assertLocaleInfo = getAssertLocaleInfo(assertVisible);

			await page.goto(`${DEPLOYMENT_URL}${pages.index.path}`);
			await assertVisible('h1', { hasText: `${pages.index.pageName} page` });

			await assertLocaleInfo(locale);
		});
	});

	it(`should view the correct local info when switching locales and pages`, async () => {
		const page = await BROWSER.newPage();
		const assertVisible = getAssertVisible(page);
		const assertLocaleInfo = getAssertLocaleInfo(assertVisible);

		await page.goto(`${DEPLOYMENT_URL}${pages.index.path}`);
		await assertVisible('h1', { hasText: `${pages.index.pageName} page` });

		await assertLocaleInfo('en');

		await navigateToAndAssertPage('getStaticProps');

		await assertLocaleInfo('en');

		await switchToAndAssertLocale('fr');

		await navigateToAndAssertPage('getServerSideProps');

		await assertLocaleInfo('fr');

		await switchToAndAssertLocale('es');

		await navigateToAndAssertPage('getStaticPropsDynamic');

		await assertLocaleInfo('es');

		await switchToAndAssertLocale('nl');

		async function navigateToAndAssertPage(targetPage: keyof typeof pages) {
			await page.locator(`a[data-test-id="links__${targetPage}"]`).click();

			await assertVisible('h1', {
				hasText: `${pages[targetPage].pageName} page`,
			});
		}

		async function switchToAndAssertLocale(locale: 'en' | 'es' | 'fr' | 'nl') {
			await page
				.locator('div[data-test-id="locale-switcher"] a', { hasText: locale })
				.click();
			await assertLocaleInfo(locale);
		}
	});
});

function getAssertLocaleInfo(
	assertVisible: ReturnType<typeof getAssertVisible>,
) {
	return async (currentLocale: 'en' | 'es' | 'fr' | 'nl') => {
		await assertVisible('[data-test-id="locale-info__current-locale"]', {
			hasText: `Current locale: ${currentLocale}`,
		});

		await assertVisible('[data-test-id="locale-info__default-locale"]', {
			hasText: 'Default locale: en',
		});

		await assertVisible('[data-test-id="locale-info__configured-locales"]', {
			hasText: 'Configured locales: en, es, fr, nl',
		});
	};
}
