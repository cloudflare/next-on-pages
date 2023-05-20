import { getCloudflareGlobalContext } from './utils/cloudflareGlobalContext';

/**
 * returns the cf object part of the incoming request
 *
 * Note: this function throws when run on the client, where there is no request
 *       to take the cf object from
 *
 * @returns the cf object if it was present in the request, undefined otherwise
 */
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
