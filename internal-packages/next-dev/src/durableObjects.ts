import type { Binding } from './index';
import type { WorkerOptions } from 'miniflare';
import type { WorkerDefinition, WorkerRegistry } from './wrangler';
import {
	EXTERNAL_DURABLE_OBJECTS_WORKER_NAME,
	EXTERNAL_DURABLE_OBJECTS_WORKER_SCRIPT,
	getIdentifier,
	getRegisteredWorkers,
} from './wrangler';
import { warnAboutExternalBindingsNotFound } from './utils';

export type DevBindingsDurableObjectOptions = Record<
	string,
	Extract<Binding, { type: 'durable-object' }>
>;

/**
 * Gets information regarding DurableObject bindings that can be passed to miniflare to access external (locally exposed in the local registry) Durable Object bindings.
 *
 * @param durableObjects
 * @returns the durableObjects and WorkersOptions objects to use or undefined if connecting to the registry and/or creating the options has failed
 */
export async function getDOBindingInfo(
	durableObjects: DevBindingsDurableObjectOptions,
): Promise<
	| {
			workerOptions: WorkerOptions;
			durableObjects: WorkerOptions['durableObjects'];
	  }
	| undefined
> {
	const requestedDurableObjectBindingNames = new Set(
		Object.keys(durableObjects ?? {}),
	);

	if (requestedDurableObjectBindingNames.size === 0) {
		return;
	}

	let registeredWorkers: WorkerRegistry | undefined;

	try {
		registeredWorkers = await getRegisteredWorkers();
	} catch {
		/* */
	}

	if (!registeredWorkers) {
		warnAboutLocalDurableObjectsNotFound(requestedDurableObjectBindingNames);
		return;
	}

	const registeredWorkersWithDOs: RegisteredWorkersWithDOs =
		getRegisteredWorkersWithDOs(registeredWorkers);

	const [foundDurableObjects, missingDurableObjects] = [
		...requestedDurableObjectBindingNames.keys(),
	].reduce(
		([foundDOs, missingDOs], durableObjectBindingName) => {
			let found = false;
			for (const [workerName, worker] of registeredWorkersWithDOs.entries()) {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				const durableObject = durableObjects[durableObjectBindingName]!;
				if (workerName === durableObject.service.name) {
					found = !!worker.durableObjects.find(
						durableObject =>
							durableObject.className === durableObject.className,
					);
				}
				if (found) break;
			}
			if (found) {
				foundDOs.add(durableObjectBindingName);
			} else {
				missingDOs.add(durableObjectBindingName);
			}
			return [foundDOs, missingDOs];
		},
		[new Set(), new Set()] as [Set<string>, Set<string>],
	);

	if (missingDurableObjects.size) {
		warnAboutLocalDurableObjectsNotFound(missingDurableObjects);
	}

	const externalDOs = collectExternalDurableObjects(
		registeredWorkersWithDOs,
		foundDurableObjects,
	);

	const script = generateDurableObjectProxyWorkerScript(
		externalDOs,
		registeredWorkersWithDOs,
	);

	// the following is a very simplified version of wrangler's code but tweaked/simplified for our use case
	// https://github.com/cloudflare/workers-sdk/blob/3077016/packages/wrangler/src/dev/miniflare.ts#L240-L288
	const externalDurableObjectWorker: WorkerOptions = {
		name: EXTERNAL_DURABLE_OBJECTS_WORKER_NAME,
		routes: [`*/${EXTERNAL_DURABLE_OBJECTS_WORKER_NAME}`],
		unsafeEphemeralDurableObjects: true,
		modules: true,
		script,
	};

	const durableObjectsToUse = externalDOs.reduce(
		(all, externalDO) => {
			return {
				...all,
				[externalDO.durableObjectName]: externalDO,
			};
		},
		{} as WorkerOptions['durableObjects'],
	);

	return {
		workerOptions: externalDurableObjectWorker,
		durableObjects: durableObjectsToUse,
	};
}

function getRegisteredWorkersWithDOs(registeredWorkers: WorkerRegistry) {
	const registeredWorkersWithDOs: Map<string, WorkerRegistry[string]> =
		new Map();

	for (const workerName of Object.keys(registeredWorkers ?? {})) {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const worker = registeredWorkers![workerName]!;
		const containsDOs = !!worker.durableObjects.length;
		if (containsDOs) {
			registeredWorkersWithDOs.set(workerName, worker);
		}
	}
	return registeredWorkersWithDOs;
}

/**
 * Collects information about durable objects exposed locally by the local registry that we can use to in
 * miniflare to give access such bindings.
 *
 * NOTE: This function contains logic taken from wrangler but customized and updated to our (simpler) use case
 * see: https://github.com/cloudflare/workers-sdk/blob/3077016/packages/wrangler/src/dev/miniflare.ts#L312-L330
 *
 * @param registeredWorkersWithDOs a map containing the registered workers containing Durable Objects we need to proxy to
 * @param foundDurableObjects durable objects found in the local registry
 * @returns array of objects containing durable object information (that we can use to generate the local DO proxy worker)
 */
function collectExternalDurableObjects(
	registeredWorkersWithDOs: RegisteredWorkersWithDOs,
	foundDurableObjects: Set<string>,
): ExternalDurableObject[] {
	return [...registeredWorkersWithDOs.entries()]
		.flatMap(([workerName, worker]) => {
			const dos = worker.durableObjects;
			return dos.map(({ name, className }) => {
				if (!foundDurableObjects.has(name)) return;

				return {
					workerName,
					durableObjectName: name,
					className: getIdentifier(`${workerName}_${className}`),
					scriptName: EXTERNAL_DURABLE_OBJECTS_WORKER_NAME,
					unsafeUniqueKey: `${workerName}-${className}`,
				};
			});
		})
		.filter(Boolean) as ExternalDurableObject[];
}

/**
 * Generates the script for a worker that can be used to proxy durable object requests to the appropriate
 * external (locally exposed in the local registry) bindings.
 *
 * NOTE: This function contains logic taken from wrangler but customized and updated to our (simpler) use case
 * see: https://github.com/cloudflare/workers-sdk/blob/3077016/packages/wrangler/src/dev/miniflare.ts#L259-L284
 *
 * @param externalDOs
 * @param registeredWorkersWithDOs a map containing the registered workers containing Durable Objects we need to proxy to
 * @returns the worker script
 */
function generateDurableObjectProxyWorkerScript(
	externalDOs: {
		workerName: string;
		className: string;
		scriptName: string;
		unsafeUniqueKey: string;
	}[],
	registeredWorkersWithDOs: RegisteredWorkersWithDOs,
) {
	return (
		EXTERNAL_DURABLE_OBJECTS_WORKER_SCRIPT +
		externalDOs
			.map(({ workerName, className }) => {
				const classNameJson = JSON.stringify(className);
				const target = registeredWorkersWithDOs.get(workerName);
				if (!target || !target.host || !target.port) return;
				const proxyUrl = `http://${target.host}:${target.port}/${EXTERNAL_DURABLE_OBJECTS_WORKER_NAME}`;
				const proxyUrlJson = JSON.stringify(proxyUrl);
				return `export const ${className} = createClass({ className: ${classNameJson}, proxyUrl: ${proxyUrlJson} });`;
			})
			.filter(Boolean)
			.join('\n')
	);
}

type RegisteredWorkersWithDOs = Map<string, WorkerDefinition>;

type ExternalDurableObject = {
	workerName: string;
	durableObjectName: string;
	className: string;
	scriptName: string;
	unsafeUniqueKey: string;
};

function warnAboutLocalDurableObjectsNotFound(
	durableObjectsNotFound: Set<string>,
): void {
	warnAboutExternalBindingsNotFound(durableObjectsNotFound, 'Durable Objects');
}
