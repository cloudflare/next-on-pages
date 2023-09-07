/**
 * returns the request's execution context (usually referred as ctx).
 *
 * Note:
 *   This function throws when run on the client, where there is execution context.
 *   This function returns the mocked execution context in non pages environments.
 *
 * @returns the request's execution context
 */
export const getRequestExecutionContext = (): ExecutionContext => {
	if (typeof process === 'undefined') {
		throw new Error(
			'Error: trying to access the request execution context on the client',
		);
	}

	const context = process.env.CF_NEXT_ON_PAGES_EXECUTION_CONTEXT;
	if (context) return context;

	return {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		waitUntil: (promise: Promise<any>) => {
			// eslint-disable-next-line no-console
			console.warn(
				'The mocked waitUntil function is executed. It may behave differently from the pages environment.',
			);
			void promise;
		},
		passThroughOnException: () => {
			// eslint-disable-next-line no-console
			console.warn(
				'The mocked passThroughOnException function is executed. It may behave differently from the pages environment.',
			);
		},
	};
};
