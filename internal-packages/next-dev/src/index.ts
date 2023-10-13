import type { WorkerOptions } from 'miniflare';
import { Miniflare, Request, Response, Headers } from 'miniflare';
import { getDOBindingInfo } from './durableObjects';
import { getServiceBindings } from './services';

/**
 * Sets up the bindings that need to be available during development time (using
 * Next.js' standard dev server)
 *
 * Note: the function is an async one but it doesn't need to be awaited
 *
 * @param options options indicating what bindings need to be available and where/if to persist them
 */
export async function setupDevBindings(
	options: DevBindingsOptions,
): Promise<void> {
	const continueSetup = shouldSetupContinue();
	if (!continueSetup) return;

	const mf = await instantiateMiniflare(options);

	const bindings = await mf.getBindings();

	monkeyPatchVmModule(bindings);
}

export type DevBindingsOptions = {
	services?: Record<string, string>;
	/**
	 * Record mapping binding names to KV namespace IDs.
	 * If a `string[]` of binding names is specified, the binding name and KV namespace ID are assumed to be the same.
	 */
	kvNamespaces?: string[] | Record<string, string>;
	/**
	 * Record mapping binding name to Durable Object class designators, where the designator is an object with the following fields:
	 *  - `className`: name of a DurableObject class
	 *  - `scriptName`: name of the Worker exporting the class
	 *
	 * Note: In order to use such bindings you need to locally run the Workers exporting any durable object class used with `wrangler dev`.
	 */
	durableObjects?: Record<
		string,
		{
			scriptName: string;
			className: string;
		}
	>;
	/**
	 * Record mapping binding names to R2 bucket names to inject as R2Bucket.
	 * If a `string[]` of binding names is specified, the binding name and bucket name are assumed to be the same.
	 */
	r2Buckets?: string[] | Record<string, string>;
	/**
	 * Record mapping binding name to D1 database IDs.
	 * If a `string[]` of binding names is specified, the binding name and database ID are assumed to be the same.
	 */
	d1Databases?: string[] | Record<string, string>;
	/**
	 * Indicates where to persist the bindings data, it defaults to the same location used by wrangler v3: `.wrangler/state/v3`
	 * (so that the same data can be easily used by both the next dev server and `wrangler pages dev`).
	 * If `false` is specified no data is persisted on the filesystem.
	 */
	persist?: false | string;
};

/**
 * Creates the miniflare instance that we use under the hood to provide access to bindings.
 *
 * @param options the user provided options
 * @returns the new miniflare instance.
 */
async function instantiateMiniflare(
	options: DevBindingsOptions,
): Promise<Miniflare> {
	const { workerOptions, durableObjects } =
		(await getDOBindingInfo(options.durableObjects)) ?? {};

	const { kvNamespaces, r2Buckets, d1Databases, services } = options;
	const bindings = {
		kvNamespaces,
		durableObjects,
		r2Buckets,
		d1Databases,
		services,
	};

	const serviceBindings = await getServiceBindings(services);

	const workers: WorkerOptions[] = [
		{
			...bindings,
			modules: true,
			script: '',
			serviceBindings,
		},
		...(workerOptions ? [workerOptions] : []),
	];

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
	});

	return mf;
}

/**
 * Next.js uses the Node.js vm module's `runInContext()` function to evaluate the edge functions
 * in a runtime context that tries to simulate as accurately as possible the actual production runtime
 * behavior, see: https://github.com/vercel/next.js/blob/ec0a8da/packages/next/src/server/web/sandbox/context.ts#L450-L452
 *
 * This function monkey-patches the Node.js vm module to override the `runInContext()` function so that
 * miniflare binding proxies can be added to the runtime context's `process.env` before the actual edge
 * functions are evaluated.
 *
 * @param bindings array containing the miniflare binding proxies to add to the runtime context's `process.env`
 */
function monkeyPatchVmModule(bindings: Record<string, unknown>) {
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
			for (const [name, binding] of Object.entries(bindings)) {
				runtimeContext.process.env[name] = binding;
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
