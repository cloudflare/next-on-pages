import type { Page } from 'playwright';

type HardNavigation = { url: string };

export async function runWithHardNavigationsChecking(
	page: Page,
	testSnippet: () => Promise<void>,
	hardNavigationsCheck: (hardNavigations: HardNavigation[]) => Promise<void>,
): Promise<void> {
	const hardNavigations: HardNavigation[] = [];

	page.on('domcontentloaded', () => {
		hardNavigations.push({ url: page.url() });
	});

	await testSnippet();

	await hardNavigationsCheck(hardNavigations);
}
