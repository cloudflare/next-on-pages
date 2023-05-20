import { getCloudflareGlobalContext } from './utils/cloudflareGlobalContext';

export function getRequestCfProperties():
	| IncomingRequestCfProperties
	| undefined {
	const cloudflareGlobalContext = getCloudflareGlobalContext();
	if (!cloudflareGlobalContext) {
		throw new Error(
			'Error: trying to access the request cf object on the client'
		);
	}
	return cloudflareGlobalContext.cf;
}
