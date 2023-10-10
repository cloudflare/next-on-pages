import fetch from 'node-fetch';
import type { DevBindingsOptions } from './index';
import type { WorkerOptions } from 'miniflare';
// import assert from "node:assert";

export type WorkerRegistry = Record<string, WorkerDefinition>;

type WorkerDefinition = {
	port: number | undefined;
	protocol: 'http' | 'https' | undefined;
	host: string | undefined;
	mode: 'local' | 'remote';
	headers?: Record<string, string>;
	durableObjects: { name: string; className: string }[];
	durableObjectsHost?: string;
	durableObjectsPort?: number;
};

const DEV_REGISTRY_PORT = '6284';
const DEV_REGISTRY_HOST = `http://localhost:${DEV_REGISTRY_PORT}`;

// This worker proxies all external Durable Objects to the Wrangler session
// where they're defined, and receives all requests from other Wrangler sessions
// for this session's Durable Objects. Note the original request URL may contain
// non-standard protocols, so we store it in a header to restore later.
const EXTERNAL_DURABLE_OBJECTS_WORKER_NAME =
	'__WRANGLER_EXTERNAL_DURABLE_OBJECTS_WORKER';
// noinspection HttpUrlsUsage
const EXTERNAL_DURABLE_OBJECTS_WORKER_SCRIPT = `
const HEADER_URL = "X-Miniflare-Durable-Object-URL";
const HEADER_NAME = "X-Miniflare-Durable-Object-Name";
const HEADER_ID = "X-Miniflare-Durable-Object-Id";

function createClass({ className, proxyUrl }) {
	return class {
		constructor(state) {
			this.id = state.id.toString();
		}
		fetch(request) {
			if (proxyUrl === undefined) {
				return new Response(\`[wrangler] Couldn't find \\\`wrangler dev\\\` session for class "\${className}" to proxy to\`, { status: 503 });
			}
			const proxyRequest = new Request(proxyUrl, request);
			proxyRequest.headers.set(HEADER_URL, request.url);
			proxyRequest.headers.set(HEADER_NAME, className);
			proxyRequest.headers.set(HEADER_ID, this.id);
			return fetch(proxyRequest);
		}
	}
}

export default {
	async fetch(request, env) {
		const originalUrl = request.headers.get(HEADER_URL);
		const className = request.headers.get(HEADER_NAME);
		const idString = request.headers.get(HEADER_ID);
		if (originalUrl === null || className === null || idString === null) {
			return new Response("[wrangler] Received Durable Object proxy request with missing headers", { status: 400 });
		}
		request = new Request(originalUrl, request);
		request.headers.delete(HEADER_URL);
		request.headers.delete(HEADER_NAME);
		request.headers.delete(HEADER_ID);
		const ns = env[className];
		const id = ns.idFromString(idString);
		const stub = ns.get(id);
		return stub.fetch(request);
	}
}
`;

export async function getRegisteredWorkers(): Promise<
	WorkerRegistry | undefined
> {
	try {
		const response = await fetch(`${DEV_REGISTRY_HOST}/workers`);
		return (await response.json()) as WorkerRegistry;
	} catch (e) {
		if (
			!['ECONNRESET', 'ECONNREFUSED'].includes(
				(e as unknown as { cause?: { code?: string } }).cause?.code || '___',
			)
		) {
			return;
		}
	}

	return;
}

export async function getDOWorkerOptions(
	durableObjects: DevBindingsOptions['durableObjects'],
): Promise<WorkerOptions | undefined> {
	if (!durableObjects || Object.keys(durableObjects).length === 0) {
		return;
	}

	const registeredWorkers = await getRegisteredWorkers();

	if (!registeredWorkers) {
		return;
	}

	const registeredWorkersWithDOs: WorkerRegistry[string][] = [];

	for (const workerName of Object.keys(registeredWorkers ?? {})) {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const worker = registeredWorkers![workerName]!;
		const containsUsedDO = !!worker.durableObjects.find(
			durableObject => !!durableObjects?.[durableObject.name],
		);
		if (containsUsedDO) {
			registeredWorkersWithDOs.push(worker);
		}
	}

	// TODO: the following is just copy pasted we need to actually create this
	// (as it is done here: https://github.com/cloudflare/workers-sdk/blob/3077016f6112754585c05b7952e456be44b9d8cd/packages/wrangler/src/dev/miniflare.ts#L312-L330)
	const externalObjects = [
		{
			className: 'do_worker_DurableObjectClass',
			scriptName: '__WRANGLER_EXTERNAL_DURABLE_OBJECTS_WORKER',
			unsafeUniqueKey: 'do_worker-DurableObjectClass',
		},
	];

	// Setup Durable Object bindings and proxy worker
	const externalDurableObjectWorker: WorkerOptions = {
		name: EXTERNAL_DURABLE_OBJECTS_WORKER_NAME,
		// Use this worker instead of the user worker if the pathname is
		// `/${EXTERNAL_DURABLE_OBJECTS_WORKER_NAME}`
		routes: [`*/${EXTERNAL_DURABLE_OBJECTS_WORKER_NAME}`],
		// Use in-memory storage for the stub object classes *declared* by this
		// script. They don't need to persist anything, and would end up using the
		// incorrect unsafe unique key.
		unsafeEphemeralDurableObjects: true,
		modules: true,
		script:
			EXTERNAL_DURABLE_OBJECTS_WORKER_SCRIPT +
			// Add stub object classes that proxy requests to the correct session
			externalObjects
				.map(({ className }) => {
					// assert(scriptName !== undefined);

					// // const identifier = getIdentifier(`${scriptName}_${className}`);
					// // const classNameJson = JSON.stringify(className);

					// debugger;
					// return `export const do_worker_DurableObjectClass = () => {};`
					// // return `export const ${identifier} = createClass({ className: ${classNameJson} });`;
					// assert(scriptName !== undefined);
					// const targetHasClass = durableObjects.some(
					// 	({ className }) => className === className
					// );

					// const identifier = getIdentifier(`${scriptName}_${className}`);
					const classNameJson = JSON.stringify(className);
					// if (
					// 	target?.host === undefined ||
					// 	target.port === undefined ||
					// 	!targetHasClass
					// ) {
					// 	// If we couldn't find the target or the class, create a stub object
					// 	// that just returns `503 Service Unavailable` responses.
					// 	return `export const ${identifier} = createClass({ className: ${classNameJson} });`;
					// } else {
					// Otherwise, create a stub object that proxies request to the
					// target session at `${hostname}:${port}`.

					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
					const targetHost = registeredWorkersWithDOs[0]?.host!;
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
					const targetPort = registeredWorkersWithDOs[0]?.port!;
					const proxyUrl = `http://${targetHost}:${targetPort}/${EXTERNAL_DURABLE_OBJECTS_WORKER_NAME}`;
					const proxyUrlJson = JSON.stringify(proxyUrl);
					// debugger;
					return `export const ${className} = createClass({ className: ${classNameJson}, proxyUrl: ${proxyUrlJson} });`;
					// }
				})
				.join('\n'),
	};

	return externalDurableObjectWorker;
}

// const IDENTIFIER_UNSAFE_REGEXP = /[^a-zA-Z0-9_$]/g;
// function getIdentifier(name: string) {
// 	return name.replace(IDENTIFIER_UNSAFE_REGEXP, "_");
// }
