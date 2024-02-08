import { describe, test } from 'vitest';

describe('getRequestContext', () => {
	// Note: we don't test `getRequestContext` in Pages components because those are
	//       recognized as client components, thus they are unable to import `getRequestContext`
	//       which is marked as server-only (not even if the import happens in server only
	//       Pages code such as `getServerSideProps`!)

	test('works in api routes', async ({ expect }) => {
		const response = await fetch(`${DEPLOYMENT_URL}/api/get-request-context`);
		expect(await response.json()).toEqual({
			kvValue: 'kv-value',
			myTomlVar: 'my var from wrangler.toml',
			typeofWaitUntil: 'function',
			typeofCfColo: 'string',
		});
	});
});
