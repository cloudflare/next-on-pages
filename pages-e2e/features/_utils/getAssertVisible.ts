import type { Page } from 'playwright';
import assert from 'node:assert';

/**
 * returns a function that asserts that an element is visible on the page
 *
 * this assertion utility waits up to 500ms for the element to appear on the page if it isn't already
 * (similarly to Playwright's built-in auto-wait which we don't have access to)
 *
 * @param page the Playwright page in use
 * @param locatorOptions the standard Playwright Locator options for the element
 * @returns the assertion utility
 */
export function getAssertVisible(page: Page) {
	return (...args: Parameters<Page['locator']>) => assertVisible(page, ...args);
}

async function assertVisible(
	page: Page,
	...[selector, options]: Parameters<Page['locator']>
): Promise<void> {
	const locator = page.locator(selector, options);
	let isVisible = false;
	try {
		await locator.waitFor({
			timeout: 500,
		});
	} catch {}
	isVisible = await locator.isVisible();
	const elementStr = `${selector}${
		Object.keys(options ?? {}).length > 0
			? `[${JSON.stringify({ options })}]`
			: ''
	}`;
	assert(isVisible, `expected ${elementStr} to be visible but it isn't`);
}
