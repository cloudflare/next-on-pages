import { describe, it } from 'vitest';

describe('Simple Pages API Routes', () => {
	it('should return a Hello world response', async ({ expect }) => {
		const response = await fetch(`${DEPLOYMENT_URL}/api/hello`);
		expect(await response.text()).toBe('Hello world');
	});

	it("should correctly read the request's headers", async ({ expect }) => {
		const response = await fetch(`${DEPLOYMENT_URL}/api/headers`, {
			headers: {
				myHeader: 'my-header-value',
				Cookie: 'cookieTestName=cookieTestValue',
			},
		});

		const respJson = await response.json();

		const myHeader = (
			respJson.headers as { name: string; value: string }[]
		).find(({ name }) => name.toLowerCase() === 'myheader');

		expect(myHeader.value).toBe('my-header-value');
		expect(respJson.cookies).toEqual([
			{ name: 'cookieTestName', value: 'cookieTestValue' },
		]);
	});
});
