/**
 * Patches the global fetch in ways necessary for Next.js (/next-on-pages) applications
 * to work
 */
export function patchFetch(): void {
	const alreadyPatched = (globalThis.fetch as Fetch)[patchFlagSymbol];

	if (alreadyPatched) return;

	applyPatch();

	(globalThis.fetch as Fetch)[patchFlagSymbol] = true;
}

function applyPatch() {
	const originalFetch = globalThis.fetch;

	globalThis.fetch = async (...args) => {
		const request = new Request(...args);

		const response = await handleInlineAssetRequest(request);
		if (response) {
			return response;
		}

		setRequestUserAgentIfNeeded(request);

		return originalFetch(request);
	};
}

/**
 * This function checks if a given request is trying to fetch an inline if it is it returns a response containing a stream for the asset,
 * otherwise returns null (signaling that the request hasn't been handled).
 *
 * This is necessary so that users can fetch urls such as: `new URL("file", import.meta.url)`
 * (used for example with `@vercel/og`)
 *
 * Note: this function's aim is to mimic the following Next behavior:
 * 	https://github.com/vercel/next.js/blob/6705c803021d3bdea7fec20e5d98f6899e49836d/packages/next/src/server/web/sandbox/fetch-inline-assets.ts
 *
 * @param request the request to handle
 * @returns the response to return to the caller if the request was for an inline asset one (and the file exists), null otherwise
 */
async function handleInlineAssetRequest(request: Request) {
	if (request.url.startsWith('blob:')) {
		try {
			const url = new URL(request.url);
			const binaryContent = (
				await import(`./__next-on-pages-dist__/assets/${url.pathname}.bin`)
			).default;

			// Note: we can't generate a real Response object here because this fetch might be called
			//       at the top level of a dynamically imported module, and such cases produce the following
			//       error:
			//           Some functionality, such as asynchronous I/O, timeouts, and generating random values,
			//           can only be performed while handling a request
			//       this is a somewhat known workerd behavior (currently kept for security and performance reasons)
			//
			//       if the above issue/constraint were to change we should replace the following with a real Response object
			const resp = {
				async arrayBuffer() {
					return binaryContent;
				},
				get body(): ReadableStream<unknown> | null {
					return new ReadableStream({
						start(controller) {
							const b = Buffer.from(binaryContent);
							controller.enqueue(b);
							controller.close();
						},
					});
				},
				async text() {
					const b = Buffer.from(binaryContent);
					return b.toString();
				},
				async json() {
					const b = Buffer.from(binaryContent);
					return JSON.stringify(b.toString());
				},
				async blob() {
					return new Blob(binaryContent);
				},
			} as Response;

			// Note: clone is necessary so that body does work
			resp.clone = (): Response => {
				return { ...resp } as Response;
			};

			return resp;
		} catch {
			/* empty */
		}
	}
	return null;
}

/**
 *	updates the provided request by adding a Next.js specific user-agent header if the request has no user-agent header
 *
 *  Note: this is done by the Vercel network, but also in their next dev server as you can see here:
 * 		https://github.com/vercel/next.js/blob/6705c803021d3bdea7fec20e5d98f6899e49836d/packages/next/src/server/web/sandbox/context.ts#L318-L320)
 * @param request the request to update
 */
function setRequestUserAgentIfNeeded(
	request: Request<unknown, RequestInitCfProperties>,
): void {
	if (!request.headers.has('user-agent')) {
		request.headers.set(`user-agent`, `Next.js Middleware`);
	}
}

const patchFlagSymbol = Symbol.for('next-on-pages fetch patch');

type Fetch = typeof globalThis.fetch & { [patchFlagSymbol]: boolean };
