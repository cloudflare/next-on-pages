import type { WorkerOptions } from 'miniflare';
import { Miniflare, Request, Response, Headers, type Json } from 'miniflare';
import type { DevBindingsDurableObjectOptions } from './durableObjects';
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

/**
 * Options for the next-dev bindings setup.
 */
export type DevBindingsOptions = {
	/**
	 * Indicates if and where to persist the bindings data, if not present or `true` it defaults to the same location
	 * used by wrangler v3: `.wrangler/state/v3` (so that the same data can be easily used by both the next dev server
	 * and `wrangler pages dev`).
	 * If `false` is specified no data is persisted on the filesystem.
	 */
	persist?: boolean | { path: string };
	/**
	 * Record declaring the bindings that the application should get access to.
	 *
	 * The keys of this record are to represent the binding names (the same that will be used to access the resource from
	 * within the Next.js application) and their values are objects containing a type property (describing what type of
	 * binding the object represents) alongside other properties (which depend on the specified type).
	 *
	 */
	bindings: Record<string, Binding>;
};

export type Binding =
	| { type: 'kv'; id: string }
	| { type: 'r2'; bucketName: string }
	| { type: 'd1'; databaseName: string }
	| { type: 'd1'; databaseId: string }
	| { type: 'durable-object'; className: string; service: ServiceDesignator }
	| { type: 'service'; service: ServiceDesignator }
	| { type: 'var'; value: string | Json };

export interface ServiceDesignator {
	name: string;
}

/**
 * Creates the miniflare instance that we use under the hood to provide access to bindings.
 *
 * @param options the user provided options
 * @returns the new miniflare instance.
 */
async function instantiateMiniflare(
	options: DevBindingsOptions,
): Promise<Miniflare> {
	options ??= {
		bindings: {},
	};

	const devBindingsDurableObjectOptions = Object.fromEntries(
		Object.entries(options.bindings ?? {}).filter(
			([, binding]) => binding.type === 'durable-object',
		),
	);

	const { workerOptions, durableObjects } =
		(await getDOBindingInfo(
			devBindingsDurableObjectOptions as DevBindingsDurableObjectOptions,
		)) ?? {};

	const bindings = await getMiniflareBindingOptions(options.bindings ?? {});

	const workers: WorkerOptions[] = [
		{
			...bindings,
			durableObjects,
			modules: true,
			script: '',
		},
		...(workerOptions ? [workerOptions] : []),
	];

	const persist = getPersistOption(options.persist);

	const mf = new Miniflare({
		workers,
		...(!persist
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
 * Get the persist option that we can then use to generate the Miniflare persist option properties
 *
 * @param persist The user provided persistence option
 * @returns false if no persistance should be applied, the path to where to store the data otherwise
 */
function getPersistOption(
	persist: DevBindingsOptions['persist'],
): string | false {
	if (persist === false) {
		// the user explicitly asked for no persistance
		return false;
	}

	if (typeof persist === 'object') {
		return persist.path;
	}

	// we default back to .wrangler/state/v3 which is the currently used
	// wrangler path (this is so that when they switch to wrangler pages dev
	// they can still interact with the same data)
	return '.wrangler/state/v3';
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

	const bindingsProxyHasBeenSetSymbol = Symbol('BINDINGS_PROXY_HAS_BEEN_SET');

	vmModule.runInContext = (
		...args: [
			string,
			Record<string, unknown> & {
				process?: { env?: Record<string | symbol, unknown> };
			},
			...[unknown],
		]
	) => {
		const runtimeContext = args[1];

		if (
			runtimeContext.process?.env &&
			!runtimeContext.process.env[bindingsProxyHasBeenSetSymbol]
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

			runtimeContext.process.env[bindingsProxyHasBeenSetSymbol] = true;
		}

		return originalRunInContext(...args);
	};
}

/**
 * Next dev server imports the config file twice (in two different processes, making it hard to track),
 * this causes the setup to run twice as well, to keep things clean and not allocate extra resources
 * (i.e. instantiate two miniflare instances) it would be best to run this function only once, this
 * function is used to try to run the setup only once, it returns a flag which indicates if the setup
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

type MiniflareBindingOptions = Pick<
	WorkerOptions,
	| 'bindings'
	| 'kvNamespaces'
	| 'durableObjects'
	| 'r2Buckets'
	| 'd1Databases'
	| 'serviceBindings'
>;

async function getMiniflareBindingOptions(
	bindings: DevBindingsOptions['bindings'],
): Promise<MiniflareBindingOptions> {
	const bindingsEntries = Object.entries(bindings);
	const d1DatabaseNamesUsedSet = new Set<string>();
	const { varBindings, kvNamespaces, d1Databases, r2Buckets, services } =
		bindingsEntries.reduce(
			(allBindings, [bindingName, bindingDetails]) => {
				if (bindingDetails.type === 'var') {
					return {
						...allBindings,
						varBindings: {
							...allBindings.varBindings,
							[bindingName]: bindingDetails.value,
						},
					};
				}
				if (bindingDetails.type === 'service') {
					return {
						...allBindings,
						services: {
							...allBindings.services,
							[bindingName]: bindingDetails.service.name,
						},
					};
				}
				if (bindingDetails.type === 'kv') {
					return {
						...allBindings,
						kvNamespaces: {
							...allBindings.kvNamespaces,
							[bindingName]: bindingDetails.id,
						},
					};
				}
				if (bindingDetails.type === 'd1') {
					let databaseId: string;
					if ('databaseId' in bindingDetails) {
						databaseId = bindingDetails.databaseId;
					} else {
						databaseId = bindingDetails.databaseName;
						d1DatabaseNamesUsedSet.add(bindingDetails.databaseName);
					}
					return {
						...allBindings,
						d1Databases: {
							...allBindings.d1Databases,
							[bindingName]: databaseId,
						},
					};
				}
				if (bindingDetails.type === 'r2') {
					return {
						...allBindings,
						r2Buckets: {
							...allBindings.r2Buckets,
							[bindingName]: bindingDetails.bucketName,
						},
					};
				}
				return allBindings;
			},
			{
				kvNamespaces: {},
				varBindings: {},
				d1Databases: {},
				r2Buckets: {},
				services: {},
			} as {
				varBindings: Record<string, Json>;
				kvNamespaces: Record<string, string>;
				d1Databases: Record<string, string>;
				r2Buckets: Record<string, string>;
				services: Record<string, string>;
			},
		);

	const serviceBindings = await getServiceBindings(services);

	if (d1DatabaseNamesUsedSet.size > 0) {
		warnAboutD1Names(Array.from(d1DatabaseNamesUsedSet.values()));
	}

	return {
		kvNamespaces,
		r2Buckets,
		d1Databases,
		bindings: varBindings,
		serviceBindings,
	};
}

export function warnAboutD1Names(d1DatabaseNamesUsed: string[]): void {
	console.warn(
		`\n\x1b[33mWarning:\n  D1 databases can currently only be referenced by their IDs so if you specify\n  ` +
			'a database name (`databaseName`) for a D1 binding that will be used as the database ID.\n  ' +
			'To avoid this warning please specify the database using its actual ID instead (`databaseId`).\n\n  ' +
			`The following database names have been used as IDs:\n${[
				...d1DatabaseNamesUsed,
			]
				.map(dbName => `   - ${dbName}`)
				.join('\n')}\x1b[0m\n\n`,
	);
}
