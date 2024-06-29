/**
 * What is this file for?
 *
 * workerd isolates share the same modules registry meaning that it can happen for the same isolate to run
 * multiple instances of the same worker and those will share the modules' state.
 *
 * This can be problematic here as React uses modules state to set and get some data
 * (in particular the ReactSharedInternals: https://github.com/facebook/react/blob/2e72ea8401/packages/shared/ReactSharedInternals.js)
 * and if different workers end up sharing the same modules state this can lead to race conditions and unexpected bugs
 * (for example: https://github.com/cloudflare/next-on-pages/issues/805).
 *
 * So this module here is an auxiliary module that we use to see if workers happen to be sharing the same modules state,
 * and if that's the case this also allows us not to run the workers in parallel (to avoid the above mentioned issue).
 *
 * Things to note:
 *  - this is a hopefully temporary workaround and should be addressed by workerd instead
 *  - this does make request handling for next-on-pages workers potentially slower, but only when
 *    the workers happen to share the same modules state (meaning that they run in the same isolate at around
 *    the same time), so although not ideal is still better than running them in an unpredictable state
 *  - this addresses the fact that workers don't end up running in parallel and generating race conditions because
 *    of the shared modules state, but it does not address the fact that the modules state can be left dirty from a worker's
 *    run and that that might effect the next worker's run, hopefully this is not an issue (i.e. React doesn't rely on modules
 *    to necessarily be clean before a run). I think this last point can only be addressed by workerd itself.
 */

let queue: string[] = [];

/**
 * This function allows the acquisition of the next-on-pages in-memory mutex, it has
 * to be run before the worker logic runs and it has to run the returned done/cleanup
 * function (to free the mutex for the next worker run)
 *
 * @param uuid the unique id which identities a worker run
 * @returns a done/cleanup function if the worker is allowed to run, null otherwise
 */
export function run(uuid: string) {
	if (!queue.includes(uuid)) {
		// add worker to queue
		queue.push(uuid);
	}

	if (queue[0] !== uuid) {
		// there's a different worker in the queue
		return null;
	}

	// this worker is the first in the queue so it can run
	return () => {
		const doneId = queue.shift();
		if (doneId !== uuid) {
			// eslint-disable-next-line no-console
			console.warn(
				'WARNING: wrong uuid removed from next-on-pages in-memory mutex, clearing queue',
			);
			queue = [];
		}
	};
}
