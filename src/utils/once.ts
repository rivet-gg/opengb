export type OnceCreate<T> = () => Promise<T>;

/**
 * A value that is created once and then cached.
 */
export interface Once<T> {
	/** Value created by `create`. */
	value?: T;

	/** If in the process of creating, this will hold the promise of the create function. */
	createPromise?: Promise<T>;

	/** If the create promise completed successfully. */
	createComplete: boolean;
}

export function createOnce<T>() {
	return {
		createComplete: false,
	};
}

export async function getOrInitOnce<T>(once: Once<T>, create: OnceCreate<T>): Promise<T> {
	if (once.createComplete) {
		return once.value!;
	} else if (once.createPromise) {
		return await once.createPromise;
	} else {
		once.createPromise = create();
		once.value = await once.createPromise;
		once.createComplete = true;
		return once.value;
	}
}
