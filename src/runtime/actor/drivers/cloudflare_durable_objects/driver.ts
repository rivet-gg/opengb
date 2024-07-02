// This file is only imported when the runtime is `cloudflare_workers_platform`.

import { Config } from "../../../mod.ts";
import { ActorDriver, CallOpts, CreateOpts, ExistsOpts, GetOrCreateAndCallOpts } from "../../driver.ts";

// TODO: ctx.waitUntil for all calls

export class CloudflareDurableObjectsActorDriver implements ActorDriver {
	public constructor(public readonly config: Config) {}

	async createActor(opts: CreateOpts): Promise<void> {
		const stub = this.getStub(opts.moduleName, opts.actorName, opts.instanceName);
		return await stub.init({
			module: opts.moduleName,
			actor: opts.actorName,
			instance: opts.instanceName,
			input: opts.input,
		});
	}

	async callActor(opts: CallOpts): Promise<unknown> {
		const stub = this.getStub(opts.moduleName, opts.actorName, opts.instanceName);

		// HACK: Fixes "Type instantiation is excessively deep and possibly infinite."
		return await stub.callRpc({
			fn: opts.fn,
			request: opts.request,
		});
	}

	async getOrCreateAndCallActor(opts: GetOrCreateAndCallOpts): Promise<unknown> {
		const stub = this.getStub(opts.moduleName, opts.actorName, opts.instanceName);

		// HACK: Fixes "Type instantiation is excessively deep and possibly infinite."
		return await stub.getOrCreateAndCallRpc({
			init: {
				module: opts.moduleName,
				actor: opts.actorName,
				instance: opts.instanceName,
				input: opts.input,
			},
			fn: opts.fn,
			request: opts.request,
		});
	}

	async actorExists(opts: ExistsOpts): Promise<boolean> {
		const stub = this.getStub(opts.moduleName, opts.actorName, opts.instanceName);
		return await stub.initialized();
	}

	private getStub(
		moduleName: string,
		actorName: string,
		instanceName: string,
	): any {
		// TODO: Fix Deno.env.get hack. This does not return a string, it returns an object.
		const ns = Deno.env.get("__GLOBAL_DURABLE_OBJECT") as any;

		const module = this.config.modules[moduleName];
		const actor = module.actors[actorName];
		const name = `%%${module.storageAlias}%%${actor.storageAlias}%%${instanceName}`;
		const id = ns.idFromName(name);

		return ns.get(id);
	}
}

export { CloudflareDurableObjectsActorDriver as ActorDriver };
