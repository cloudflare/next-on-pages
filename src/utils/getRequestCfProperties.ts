import { getCloudflareGlobalContextAls } from './utils/cloudflareGlobalContext';

export function getRequestCfProperties():
	| IncomingRequestCfProperties
	| undefined {
	const cloudflareGlobalContextAls = getCloudflareGlobalContextAls();
	if (!cloudflareGlobalContextAls) {
		throw new Error(
			'Error: trying to access the request cf object on the client'
		);
	}
	const store = cloudflareGlobalContextAls.getStore();
	return store?.cf;
}
