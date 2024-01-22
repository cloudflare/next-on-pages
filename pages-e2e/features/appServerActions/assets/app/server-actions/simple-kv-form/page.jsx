import { revalidatePath } from 'next/cache';

export const runtime = 'edge';

const key = 'server-actions-simple-kv-form-key';

export default async function SimpleKvFormsPage() {
	async function set(formData) {
		'use server';
		const myKv = process.env.MY_KV;
		await myKv.put(key, formData.get('value')?.toString() ?? '');
		revalidatePath('/server-actions/simple-kv-form');
	}

	async function del() {
		'use server';
		const myKv = process.env.MY_KV;
		await myKv.delete(key);
		revalidatePath('/server-actions/simple-kv-form');
	}

	const myKv = process.env.MY_KV;
	const value = await myKv.get(key);

	return (
		<main style={{ padding: '1rem' }}>
			<h1>Server Actions - Simple KV Form</h1>
			<p data-test-id="kv-value-info" style={{ marginBlock: '1rem' }}>
				{value !== null
					? `The key's value is "${value}"`
					: 'No value is set for the key'}
			</p>
			<form action={!value ? set : del}>
				{!value && (
					<>
						<label htmlFor="value">Set value to: </label>
						<input
							data-test-id="form-input"
							type="text"
							id="value"
							name="value"
							required
						/>
						<br />
					</>
				)}
				<button data-test-id="form-submit" style={{ marginBlock: '1rem' }}>
					{!value ? 'Set value' : 'Delete value'}
				</button>
			</form>
			<form action={del}>
				<button data-test-id="clear-value">clear value</button>
			</form>
		</main>
	);
}
