import { Miniflare } from 'miniflare';

export async function setupDevBindings(options: DevBindingsOptions) {
	// we let the user define where to persist the data, we default back
	// to .wrangler/state/v3 which is the currently used wrangler path
	// (this is so that when they switch to wrangler pages dev they can
	// still interact with the same data)
	const persist = options?.persist ?? '.wrangler/state/v3';

	const mf = new Miniflare({
		modules: true,
		script: '',
		...(persist === false
			? {
					// no data persistence
			  }
			: {
					kvPersist: `${persist}/kv`,
					durableObjectsPersist: `${persist}/do`,
					r2Persist: `${persist}/r2`,
					d1Persist: `${persist}/d1`,
			  }),
		...(options ?? {}),
	});

	const bindingsCollections = await Promise.all([
		collectBindings(mf, 'KV', options?.kvNamespaces ?? []),
		collectBindings(mf, 'DO', options?.durableObjects ?? []),
		collectBindings(mf, 'R2', options?.r2Buckets ?? []),
		collectBindings(mf, 'D1', options?.d1Databases ?? []),
	]);

	const bindings = bindingsCollections.flat();

	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const vmModule = require('vm');
	const originalRunInContext = vmModule.runInContext.bind(vmModule);

	vmModule.runInContext = (
		...args: [
			string,
			{ process?: { env?: Record<string, unknown> } },
			...[unknown],
		]
	) => {
		const runtimeContext = args[1];
		if (
			runtimeContext.process?.env &&
			!runtimeContext.process?.env?.['BINDINGS_PROXY_SET']
		) {
			for (const binding of bindings) {
				runtimeContext.process.env[binding.name] = binding.binding;
			}

			runtimeContext.process.env['BINDINGS_PROXY_SET'] = true;
		}

		return originalRunInContext(...args);
	};
}

async function collectBindings(
	mf: Miniflare,
	type: 'KV' | 'DO' | 'R2' | 'D1',
	bindingsOpts: string[] | Record<string, unknown>,
) {
	const bindingNames = getBindingsNames(bindingsOpts);
	const bindingGetterFn = {
		KV: mf.getKVNamespace.bind(mf),
		DO: mf.getDurableObjectNamespace.bind(mf),
		R2: mf.getR2Bucket.bind(mf),
		D1: mf.getD1Database.bind(mf),
	}[type];
	return Promise.all(
		bindingNames.map(async bindingName => {
			return {
				name: bindingName,
				type,
				binding: await bindingGetterFn(bindingName),
			};
		}),
	);
}

function getBindingsNames(
	bindings: string[] | Record<string, unknown>,
): string[] {
	if (Array.isArray(bindings)) return bindings;
	return Object.keys(bindings);
}

export type DevBindingsOptions = {
	kvNamespaces?: string[] | Record<string, string>;
	durableObjects?: Record<
		string,
		| string
		| {
				scriptName?: string | undefined;
				unsafeUniqueKey?: string | undefined;
				className: string;
		  }
	>;
	r2Buckets?: string[] | Record<string, string>;
	d1Databases?: string[] | Record<string, string>;
	persist?: false | string;
};
