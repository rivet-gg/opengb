// This file is only imported when the runtime is `Deno`. See `actor_cf.ts` in the same directory.

const ENCODER = new TextEncoder();
const ACTOR_STORAGE: Map<string, {
	actor: ActorBase;
	storage: Map<string, any>;
}> = new Map();

export const ACTOR_DRIVER = {
	async getId(moduleName: string, actorName: string, label: string) {
		const storageId = config.modules[moduleName].actors[actorName].storageId;
		const name = `%%${storageId}%%${label}`;

		return await hash(name);
	},
	async getActor(moduleName: string, actorName: string, label: string) {
		const id = await ACTOR_DRIVER.getId(moduleName, actorName, label);
		const entry = ACTOR_STORAGE.get(id);

		if (entry == undefined) throw new Error("actor not initialized");

		return entry.actor;
	},
	async createActor(moduleName: string, actorName: string, label: string, input: any) {
		const id = await ACTOR_DRIVER.getId(moduleName, actorName, label);

		// Create actor instance
		const actorClass = config.modules[moduleName].actors[actorName].actor;
		const actor = new actorClass(new StorageProxy(id), actorClass.buildState(input));

		ACTOR_STORAGE.set(id, {
			actor,
			storage: new Map(),
		});
	},
	async callActor(stub: ActorBase, fn: string, ...args: any[]) {
		let res = (stub as any)[fn](...args);
		if (res instanceof Promise) res = await res;

		return res;
	},
	async actorExists(moduleName: string, actorName: string, label: string) {
		const id = await ACTOR_DRIVER.getId(moduleName, actorName, label);

		return ACTOR_STORAGE.has(id);
	},
};

/**
* Actor implementation that user-made actors will extend.
* Not meant to be instantiated.
*/
export abstract class ActorBase {
	static buildState(_input: unknown): any {
		throw Error("unimplemented");
	}

	constructor(public storage: StorageProxy, public state: unknown) {}
}

// Emulates the storage from cloudflare durable objects
export class StorageProxy {
	constructor(private id: string) {}

	async get(keys: string | string[]): Promise<Map<string, any> | any> {
		if (keys instanceof Array) {
			return new Map(keys.map((key) => [key, ACTOR_STORAGE.get(this.id)!.storage.get(key)]));
		} else {
			return ACTOR_STORAGE.get(this.id)!.storage.get(keys);
		}
	}

	async put(key: string, value: any) {
		ACTOR_STORAGE.get(this.id)!.storage.set(key, value);
	}

	async delete(keys: string | string[]) {
		const handle = ACTOR_STORAGE.get(this.id)!.storage;

		if (keys instanceof Array) {
			return keys.map((key) => {
				const exists = handle.has(key);

				if (exists) handle.delete(key);

				return exists;
			}).reduce((s, a) => s + Number(a), 0);
		} else {
			const exists = handle.has(keys);

			if (exists) handle.delete(keys);

			return exists;
		}
	}
}

async function hash(input: string) {
	const data = ENCODER.encode(input);
	const hash = await crypto.subtle.digest("SHA-256", data);
	const hashString = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");

	return hashString;
}
