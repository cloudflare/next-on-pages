import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

export default async function SimpleKvFormsPage() {
	const {
		env: { MY_TOML_VAR, MY_TOML_KV },
		ctx,
		cf,
	} = getRequestContext();

	await MY_TOML_KV.put('kv-key', 'kv-value');
	const kvValue = await MY_TOML_KV.get('kv-key');

	return (
		<main style={{ padding: '1rem' }}>
			<h1>Server Component</h1>
			<p data-test-id="my-toml-var">MY_TOML_VAR = '{MY_TOML_VAR}'</p>
			<p data-test-id="kv-value">the KV value is '{kvValue}'</p>
			<p data-test-id="typeof-wait-until">
				typeof ctx.waitUntil = '{typeof ctx.waitUntil}'
			</p>
			<p data-test-id="typeof-cf-colo">typeof cf.colo = '{typeof cf.colo}'</p>
		</main>
	);
}
