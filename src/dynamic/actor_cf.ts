// This file is only imported when the runtime is `Cloudflare`. See `actor.ts` in the same directory.

// This import comes directly from the workers runtime
import { DurableObject } from "cloudflare:workers";

export const ACTOR_DRIVER = {
	async getId(moduleName: string, actorName: string, label: string) {
		const storageId = config.modules[moduleName].actors[actorName].storageId;
		const name = `%%${storageId}%%${label}`;
		const doHandle = Deno.env.get("__GLOBAL_DURABLE_OBJECT") as any as DurableObjectHandle;

		// throw new Error(`${name}\n${doHandle.idFromName(name)}`);

		return doHandle.idFromName(name);
	},
	async getActor(moduleName: string, actorName: string, label: string) {
		const id = await ACTOR_DRIVER.getId(moduleName, actorName, label);
		const doHandle = Deno.env.get("__GLOBAL_DURABLE_OBJECT") as any as DurableObjectHandle;
		const doStub = doHandle.get(id) as __GlobalDurableObject;

		return doStub;
	},
	async createActor(moduleName: string, actorName: string, label: string, input: any) {
		const stub = await ACTOR_DRIVER.getActor(moduleName, actorName, label);

		await stub.__init(moduleName, actorName, input);

		return stub;
	},
	async callActor(stub: __GlobalDurableObject, fn: string, ...args: any[]) {
		return await stub.__call(fn, args);
	},
	async actorExists(moduleName: string, actorName: string, label: string) {
		const stub = await ACTOR_DRIVER.getActor(moduleName, actorName, label);

		return await stub.__initialized();
	},
};

export class __GlobalDurableObject extends DurableObject {
	async __init(moduleName: string, actorName: string, input: any) {
		// Store module name and actor name
		await this.ctx.storage.put("__path", [moduleName, actorName]);

		// Build initial state
		const state = config.modules[moduleName].actors[actorName].actor.buildState(input);
		await this.ctx.storage.put("state", state);
	}

	async __initialized() {
		return await this.ctx.storage.get("__path") != undefined;
	}

	async __call(fn: string, args: any[]): Promise<any> {
		const storageRes = await this.ctx.storage.get(["state", "__path"]);
		const state = storageRes.get("state");
		if (state == undefined) throw Error("actor not initiated");

		// Create actor instance
		const [moduleName, actorName] = storageRes.get("__path");

		const actorClass = config.modules[moduleName].actors[actorName].actor;
		const actor = new actorClass(this.ctx.storage, state);

		// Run actor function
		let res = (actor as any)[fn](...args);
		if (res instanceof Promise) res = await res;

		// Update state
		await this.ctx.storage.put("state", actor!.state);

		return res;
	}
}

/**
* Actor implementation that user-made actors will extend.
* Not meant to be instantiated.
*/
export abstract class ActorBase {
	static buildState(_input: unknown): any {
		throw Error("buildState unimplemented");
	}

	private constructor(public storage: DurableObjectStorage, public state: unknown) {}
}

// TODO: Replace with imported types, maybe from denoflare
declare type DurableObjectCtx = {
	storage: DurableObjectStorage;
};
declare class DurableObjectStorage {
	get(keys: string | string[]): Promise<Map<string, any> | any>;
	put(key: string, value: any): Promise<void>;
	delete(keys: string | string[]): Promise<number | boolean>;
}
declare class DurableObjectHandle {
	idFromName(name: string): DurableObjectId;
	get(id: DurableObjectId): DurableObject;
}
declare type DurableObjectId = any;
declare type DurableObjectEnv = any;

declare class DurableObject {
	protected ctx: DurableObjectCtx;
	protected env: DurableObjectEnv;
}
