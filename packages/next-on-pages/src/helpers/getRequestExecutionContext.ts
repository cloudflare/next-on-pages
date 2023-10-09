/**
 * returns the request's execution context (usually referred as ctx).
 *
 * Note:
 *   This function throws when run on the client, where there is execution context.
 *   This function returns the mocked execution context in non pages environments.
 *
 * @returns the request's execution context
 */
export const getRequestExecutionContext = (): ExecutionContext | undefined => {
	if (typeof process === 'undefined') {
		return undefined;
	}

	const context = process.env.CF_NEXT_ON_PAGES_EXECUTION_CONTEXT;
	if (context) {
		return context;
	}

	return undefined;
};

export const getSafeRequestExecutionContext = (): ExecutionContext => {
	const context = getRequestExecutionContext();

	if (context) {
		return context;
	}

	return {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		waitUntil: (promise: Promise<any>) => {
			void promise;
		},
		passThroughOnException: () => {
			// no-op
		},
	};
};
