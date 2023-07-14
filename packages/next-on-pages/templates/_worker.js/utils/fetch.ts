export function patchFetchToAllowBundledAssets(): void {
	const flagSymbol = Symbol.for('next-on-pages bundled assets fetch patch');

	const alreadyPatched = (
		globalThis.fetch as unknown as { [flagSymbol]: boolean }
	)[flagSymbol];
	if (alreadyPatched) {
		return;
	}

	applyPatch();

	(globalThis.fetch as unknown as { [flagSymbol]: boolean })[flagSymbol] = true;
}

function applyPatch() {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (...args) => {
		const request = new Request(...args);

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
								return pump();
								function pump() {
									const b = Buffer.from(binaryContent);
									controller.enqueue(b);
									controller.close();
									return pump();
								}
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
					return resp;
				};

				return resp;
			} catch {
				/* empty, let's just fallback to the original fetch */
			}
		}

		return originalFetch(request);
	};
}
