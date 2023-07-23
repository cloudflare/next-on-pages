import type { Page } from 'puppeteer';
import puppeteer from 'puppeteer';
import type { NextConfig } from './NextConfig';

export async function scrapeConfigs(includeNextOnPages?: true): Promise<{
	allNextConfigs: NextConfig[];
	nextOnPagesDocumentedNextConfigs: string[];
}>;
export async function scrapeConfigs(
	includeNextOnPages: false,
): Promise<{ allNextConfigs: NextConfig[] }>;
export async function scrapeConfigs(includeNextOnPages = true): Promise<{
	allNextConfigs: NextConfig[];
	nextOnPagesDocumentedNextConfigs?: string[];
}> {
	const browser = await puppeteer.launch({
		headless: 'new',
	});
	const page = await browser.newPage();

	const allNextConfigs = await getNextConfigsFromNextDocs(page);

	const nextOnPagesDocumentedNextConfigs = includeNextOnPages
		? await getNextOnPagesDocumentedNextConfigs(page)
		: undefined;

	await browser.close();
	return { allNextConfigs, nextOnPagesDocumentedNextConfigs };
}

async function getNextOnPagesDocumentedNextConfigs(
	page: Page,
): Promise<string[]> {
	await page.goto(
		'https://github.com/cloudflare/next-on-pages/blob/main/packages/next-on-pages/docs/supported.md',
	);
	const nextOnPagesDocumentedNextConfigs: string[] = await page.$$eval(
		'h3:has( > a[href="#nextconfigjs-properties"]) ~ table > tbody > tr > td:first-child',
		els =>
			els.map(el => {
				// Note: footnotes leave a number at the end of the text, so we remove it here
				return el.textContent.replace(/\d*$/, '');
			}),
	);
	return nextOnPagesDocumentedNextConfigs;
}

async function getNextConfigsFromNextDocs(page: Page): Promise<NextConfig[]> {
	const pagesNextConfigsArray = await extractNextConfigsInfoFromNextDocsPage(
		page,
		'pages',
	);
	const appNextConfigsArray = await extractNextConfigsInfoFromNextDocsPage(
		page,
		'app',
	);

	const commonNextConfigs = appNextConfigsArray
		.map(config => ({
			app: config,
			pages: pagesNextConfigsArray.find(
				pagesConfig => pagesConfig.configName === config.configName,
			),
		}))
		.filter(configs => !!configs.pages)
		.map(config => ({
			configName: config.app.configName,
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			urls: [...config.app.urls, ...config.pages!.urls],
		}));

	const isCommonConfigName = (configName: string) =>
		!!commonNextConfigs.find(
			commonConfig => commonConfig.configName === configName,
		);

	const appSpecificNextConfigs = appNextConfigsArray.filter(
		config => !isCommonConfigName(config.configName),
	);
	const pagesSpecificNextConfigs = pagesNextConfigsArray.filter(
		config => !isCommonConfigName(config.configName),
	);

	const configs = [
		...commonNextConfigs,
		...appSpecificNextConfigs,
		...pagesSpecificNextConfigs,
	].sort((a, b) => a.configName.localeCompare(b.configName));
	return configs;
}

async function extractNextConfigsInfoFromNextDocsPage(
	page: Page,
	type: 'app' | 'pages',
): Promise<NextConfig[]> {
	const url = `https://nextjs.org/docs/${type}/api-reference/next-config-js`;

	await page.goto(url);

	const configs = await page.$$eval(
		'article a.block',
		(els, type) =>
			els.map(el => {
				const configName = el.querySelector('h3').textContent;
				const url = {
					type,
					href: el.href,
				};
				return { configName, urls: [url] };
			}),
		type,
	);
	return configs;
}
