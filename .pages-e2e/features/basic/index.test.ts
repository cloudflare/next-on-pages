import { describe, it } from 'vitest';

describe('index page', () => {
	it('serves the SSRed index.html at the root', async ({ expect }) => {
		const response = await fetch(DEPLOYMENT_URL);
		expect(await response.text()).toMatchInlineSnapshot(`
			"<!DOCTYPE html>
			<html>
				<body>
					<h1>Hello, world!</h1>
				</body>
			</html>
			"
		`);
	});

	// ...
});
