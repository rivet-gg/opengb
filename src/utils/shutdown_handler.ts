export type ShutdownFn = () => Promise<void>;

interface ShutdownHandler {
	fns: ShutdownFn[];
}

const SHUTDOWN_HANDLER: ShutdownHandler = {
	fns: [],
};

/**
 * Adds a function to be ran on shutdown.
 */
export function addShutdownHandler(fn: ShutdownFn) {
	SHUTDOWN_HANDLER.fns.push(fn);
}

/**
 * Runs all shutdown functions.
 */
export async function runShutdown() {
	await Promise.all(SHUTDOWN_HANDLER.fns.map((fn) => fn()));
}
