export const config = {
	runtime: 'experimental-edge',
};

import { getRequestContext } from '@cloudflare/next-on-pages';

export default async function handler() {
	const {
		env: { MY_TOML_VAR: myTomlVar, MY_TOML_KV },
		ctx,
		cf,
	} = getRequestContext();

	await MY_TOML_KV.put('kv-key', 'kv-value');
	const kvValue = await MY_TOML_KV.get('kv-key');

	return Response.json({
		myTomlVar,
		kvValue,
		typeofWaitUntil: typeof ctx.waitUntil,
		typeofCfColo: typeof cf.colo,
	});
}
