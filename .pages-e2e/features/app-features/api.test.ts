import { describe, it } from 'vitest';

describe('my rsc page', () => {
	it('serves the SSRed page successfully', async ({ expect }) => {
		const response = await fetch(`${DEPLOYMENT_URL}/my-cmp`);

		// Note: could we also for example here test KV access or something
		//       like that?

		expect(await response.text()).toMatchInlineSnapshot(`
			"<!DOCTYPE html>
			<html>
				<body>
					<h1>My page!</h1>
				</body>
			</html>
			"
		`);
	});

	// ...
});
