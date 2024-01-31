// This file contains deprecated code and it should be deleted in the next major release

import type { Json } from 'miniflare';
import { getBindingsProxy } from 'wrangler';
import { resolve, dirname } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { monkeyPatchVmModule } from './shared';

const tmpWranglerJsonPath = resolve(
	'node_modules',
	'@cloudflare',
	'next-on-pages',
	'__next-dev',
	'wrangler.json',
);

/**
 * @deprecated Use setupDevPlatform instead
 *
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

	if (!options) {
		throwError('No options provided to setupDevBindings');
	}

	if (!options.bindings) {
		throwError("The provided options object doesn't include a bindings field");
	}

	await buildWranglerJson(options.bindings);

	monkeyPatchVmModule(
		await getBindingsProxy({
			...options,
			configPath: tmpWranglerJsonPath,
			experimentalJsonConfig: true,
		}),
	);
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

function throwError(message: string): never {
	throw new Error(`⚠️ [setupDevBindings Error]: ${message}`);
}

async function buildWranglerJson(
	bindings: Record<string, Binding>,
): Promise<void> {
	const bindingsEntries = Object.entries(bindings);

	const vars = Object.fromEntries(
		bindingsEntries
			.map(([bindingName, binding]) => {
				if (binding.type !== 'var') return null;

				return [bindingName, binding.value];
			})
			.filter(Boolean) as [string, string | Json][],
	);

	function extractBindings<T extends Binding['type']>(
		type: T,
		fn: (binding: {
			bindingName: string;
			binding: Extract<Binding, { type: T }>;
		}) => unknown,
	): unknown[] {
		return bindingsEntries
			.map(([bindingName, binding]) => {
				if (binding.type !== type) {
					return null;
				}

				return fn({
					bindingName,
					binding: binding as Extract<Binding, { type: T }>,
				});
			})
			.filter(Boolean);
	}

	const services = extractBindings('service', ({ bindingName, binding }) => ({
		binding: bindingName,
		service: binding.service.name,
	}));

	const kv_namespaces = extractBindings('kv', ({ bindingName, binding }) => ({
		binding: bindingName,
		id: binding.id,
	}));

	const doBindings = extractBindings(
		'durable-object',
		({ bindingName, binding }) => ({
			name: bindingName,
			script_name: binding.service.name,
			class_name: binding.className,
		}),
	);

	const d1_databases = extractBindings('d1', ({ bindingName, binding }) => {
		const database =
			'databaseName' in binding ? binding.databaseName : binding.databaseId;

		return {
			binding: bindingName,
			database_name: database,
			database_id: database,
		};
	});

	const r2_buckets = extractBindings('r2', ({ bindingName, binding }) => ({
		binding: bindingName,
		bucket_name: binding.bucketName,
	}));

	const wranglerJson = JSON.stringify({
		vars,
		kv_namespaces,
		services,
		durable_objects: { bindings: doBindings },
		d1_databases,
		r2_buckets,
	});
	await mkdir(dirname(tmpWranglerJsonPath), { recursive: true });
	await writeFile(tmpWranglerJsonPath, wranglerJson, 'utf8');
}
