import { Request as NodeFetchRequest } from 'node-fetch';
import { Response } from 'miniflare';
import type { Request } from 'miniflare';
import type { WorkerDefinition } from './wrangler';
import { getRegisteredWorkers, type WorkerRegistry } from './wrangler';
import fetch from 'node-fetch';
import { warnAboutExternalBindingsNotFound } from './utils';

export async function getServiceBindings(
	services: Record<string, string> | undefined,
): Promise<ServiceBindings | undefined> {
	if (Object.keys(services ?? {}).length === 0) {
		return;
	}

	let registeredWorkers: WorkerRegistry | undefined;

	try {
		registeredWorkers = await getRegisteredWorkers();
	} catch {
		/* */
	}

	if (!registeredWorkers) {
		warnAboutServicesNotFound(new Set(Object.keys(services ?? {})));
		return;
	}

	const [foundServices, missingServices] = Object.entries(
		services ?? {},
	).reduce(
		([found, missing], [bindingName, serviceName]) => {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const service = registeredWorkers![serviceName];
			return service
				? [[...found, { bindingName, workerDefinition: service }], missing]
				: [found, [...missing, { bindingName }]];
		},
		[[], []] as [
			{ bindingName: string; workerDefinition: WorkerDefinition }[],
			{ bindingName: string }[],
		],
	);

	if (missingServices.length) {
		warnAboutServicesNotFound(
			new Set(missingServices.map(({ bindingName }) => bindingName)),
		);
	}

	const serviceBindings = foundServices.reduce(
		(acc, { bindingName, workerDefinition }) => {
			return {
				...acc,
				[bindingName]: getServiceBindingProxyFetch(workerDefinition),
			};
		},
		{} as ServiceBindings,
	);

	return serviceBindings;
}

type ServiceBindings = Record<string, (req: Request) => Promise<Response>>;

function getServiceBindingProxyFetch(workerDefinition: WorkerDefinition) {
	const { protocol, host, port } = workerDefinition;

	const getExternalUrl = (request: Request) => {
		const newUrl = new URL(request.url);
		if (protocol) newUrl.protocol = protocol;
		if (host) newUrl.host = host;
		if (port) newUrl.port = `${port}`;
		return newUrl;
	};

	return async (request: Request) => {
		const newUrl = getExternalUrl(request);
		const newRequest = new NodeFetchRequest(
			newUrl,
			request as unknown as NodeFetchRequest,
		);
		const resp = await fetch(newRequest);
		const respBody = await resp.arrayBuffer();
		return new Response(respBody, resp as unknown as Response);
	};
}

function warnAboutServicesNotFound(servicesNotFound: Set<string>): void {
	warnAboutExternalBindingsNotFound(servicesNotFound, 'Service Bindings');
}
