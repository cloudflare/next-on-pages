const queue = [];

export function run(uuid) {
    if(!queue.includes(uuid)) {
        // add worker to queue
        queue.push(uuid);
    }

    if(queue[0] !== uuid) {
        // there's a different worker in the queue
        return false;
    }

    // this worker is the first in the queue so it can run
    return true;
}

export function done(uuid) {
    const doneId = queue.shift();
    if(doneId !== uuid) {
        throw new Error('something wrong happened and the wrong uuid was removed from the next-on-pages semaphore');
    }
}