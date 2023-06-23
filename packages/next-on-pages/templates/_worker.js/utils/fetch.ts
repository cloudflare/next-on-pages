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

				return {
					arrayBuffer() {
						return binaryContent;
					},
				} as Response;
			} catch {
				/* empty, let's just fallback to the original fetch */
			}
		}

		return originalFetch(request);
	};
}
