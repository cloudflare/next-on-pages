import type { WorkerOptions } from 'miniflare';
import { Miniflare, Request, Response, Headers } from 'miniflare';
import { getDOBindingInfo } from './do';

export async function setupDevBindings(options: DevBindingsOptions) {
	const continueSetup = shouldSetupContinue();
	if (!continueSetup) return;

	const mf = await instantiateMiniflare(options);

	const bindings = await collectBindings(mf, options);

	monkeyPatchVmModule(bindings);
}

async function instantiateMiniflare(options: DevBindingsOptions) {
	const { workerOptions, durableObjects } =
		(await getDOBindingInfo(options.durableObjects)) ?? {};

	const workers: WorkerOptions[] = [
		{
			durableObjects,
			modules: true,
			script: '',
		},
		...(workerOptions ? [workerOptions] : []),
	];

	options ??= {};

	// we need to delete the user provided durableObjects that we haven't
	// been able to find
	Object.keys(options.durableObjects ?? {}).forEach(durableObject => {
		if (!durableObjects?.[durableObject]) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			delete options.durableObjects![durableObject];
		}
	});

	// we let the user define where to persist the data, we default back
	// to .wrangler/state/v3 which is the currently used wrangler path
	// (this is so that when they switch to wrangler pages dev they can
	// still interact with the same data)
	const persist = options?.persist ?? '.wrangler/state/v3';

	const mf = new Miniflare({
		workers,
		...(persist === false
			? {
					// the user specifically requested no data persistence
			  }
			: {
					kvPersist: `${persist}/kv`,
					durableObjectsPersist: `${persist}/do`,
					r2Persist: `${persist}/r2`,
					d1Persist: `${persist}/d1`,
			  }),
		...options,
	});

	return mf;
}

async function collectBindings(
	mf: Miniflare,
	options: DevBindingsOptions,
): Promise<{ name: string; binding: MiniflareBinding }[]> {
	const bindingGetterFnMap = {
		KV: mf.getKVNamespace.bind(mf),
		DO: mf.getDurableObjectNamespace.bind(mf),
		R2: mf.getR2Bucket.bind(mf),
		D1: mf.getD1Database.bind(mf),
	};
	async function collectBindingsOfType(
		type: BindingType,
		bindingsOpts: string[] | Record<string, unknown>,
	) {
		const bindingNames = getBindingsNames(bindingsOpts);
		const bindingGetterFn = bindingGetterFnMap[type];
		return Promise.all(
			bindingNames.map(async bindingName => {
				return {
					name: bindingName,
					binding: await bindingGetterFn(bindingName),
				};
			}),
		);
	}

	const bindings = (
		await Promise.all([
			collectBindingsOfType('KV', options?.kvNamespaces ?? []),
			collectBindingsOfType('DO', options?.durableObjects ?? []),
			collectBindingsOfType('R2', options?.r2Buckets ?? []),
			collectBindingsOfType('D1', options?.d1Databases ?? []),
		])
	).flat();

	return bindings;
}

function monkeyPatchVmModule(
	bindings: { name: string; binding: MiniflareBinding }[],
) {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const vmModule = require('vm');

	const originalRunInContext = vmModule.runInContext.bind(vmModule);

	vmModule.runInContext = (
		...args: [
			string,
			Record<string, unknown> & { process?: { env?: Record<string, unknown> } },
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

			runtimeContext['Request'] = new Proxy(Request, {
				construct(target, args, newTarget) {
					if (
						args.length >= 2 &&
						typeof args[1] === 'object' &&
						args[1].duplex === undefined
					) {
						args[1].duplex = 'half';
					}
					return Reflect.construct(target, args, newTarget);
				},
			});
			runtimeContext['Response'] = Response;
			runtimeContext['Headers'] = Headers;

			runtimeContext.process.env['BINDINGS_PROXY_SET'] = true;
		}

		return originalRunInContext(...args);
	};
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

type BindingType = 'KV' | 'DO' | 'R2' | 'D1';

type KVMiniflareBinding = Awaited<ReturnType<Miniflare['getKVNamespace']>>;
type DOMiniflareBinding = Awaited<
	ReturnType<Miniflare['getDurableObjectNamespace']>
>;
type R2MiniflareBinding = Awaited<ReturnType<Miniflare['getR2Bucket']>>;
type D1MiniflareBinding = Awaited<ReturnType<Miniflare['getD1Database']>>;
type MiniflareBinding =
	| KVMiniflareBinding
	| DOMiniflareBinding
	| R2MiniflareBinding
	| D1MiniflareBinding;

/**
 * Next dev server imports the config file twice (in two different processes, making it hard to track),
 * this causes the setup to run twice as well, to keep things clean and not allocate extra resources
 * (i.e. instantiate two miniflare instances) it would be best to run this function only once, this
 * function if used to try to run the setup only once, it returns a flag which indicates if the setup
 * should run in the current process or not.
 *
 * @returns boolean indicating if the setup should continue
 */
function shouldSetupContinue(): boolean {
	// Via debugging we've seen that AsyncLocalStorage is only set in one of the
	// two processes so we're using it as the differentiator between the two
	const AsyncLocalStorage = (
		globalThis as unknown as { AsyncLocalStorage?: unknown }
	)['AsyncLocalStorage'];
	return !!AsyncLocalStorage;
}
