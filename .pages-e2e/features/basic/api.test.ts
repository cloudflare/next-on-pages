import { describe, it } from 'vitest';

// NOTE: I made sure that all the fixtures contain this api edge route

describe('api route', () => {
	it('provides an api/hello api route with returns "hello world"', async ({
		expect,
	}) => {
		const response = await fetch(`${DEPLOYMENT_URL}/api/hello`);
		expect(await response.text()).toMatchInlineSnapshot('hello world');
	});

	// ...
});
