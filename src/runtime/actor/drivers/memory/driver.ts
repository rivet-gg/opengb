// This file is only imported when the runtime is `deno`
//
import { Config } from "../../../mod.ts";
import { ActorDriver, CallOpts, CreateOpts, ExistsOpts, GetOrCreateAndCallOpts } from "../../driver.ts";
import { MemorySchedule } from "./schedule.ts";
import { MemoryStorage } from "./storage.ts";

export interface ActorEntry {
	moduleName: string;
	actorName: string;
	instanceName: string;
	state?: string;
	storage: Map<string, string>;
}

export class MemoryActorDriver implements ActorDriver {
	private encoder = new TextEncoder();
	private actorRegistry = new Map<string, ActorEntry>();

	public constructor(public readonly config: Config) {}

	async createActor({ moduleName, actorName, instanceName, input }: CreateOpts): Promise<void> {
		const id = await this.getId(moduleName, actorName, instanceName);

		// Ensure doesn't already exist
		if (this.actorRegistry.has(await this.getId(moduleName, actorName, instanceName))) {
			throw new Error("actor already created");
		}

		// Build drivers
		const actorEntry: ActorEntry = {
			moduleName,
			actorName,
			instanceName,
			state: undefined,
			storage: new Map(),
		};

		// TODO: cache init actor in memory
		// Run actor function
		const actor = this.constructActor(actorEntry, true);
		let initRes = actor.initialize(input);
		if (initRes instanceof Promise) initRes = await initRes;

		// Save state
		actorEntry.state = JSON.stringify(initRes);

		// Save actor
		this.actorRegistry.set(id, actorEntry);
	}
	async callActor({ moduleName, actorName, instanceName, fn, request }: CallOpts): Promise<unknown> {
		const entry = await this.getEntry(moduleName, actorName, instanceName);
		const actor = this.constructActor(entry, false);

		// Run actor function
		let callRes = (actor as any)[fn](request);
		if (callRes instanceof Promise) callRes = await callRes;

		// Save state
		entry.state = JSON.stringify(actor.state);

		return callRes;
	}

	async getOrCreateAndCallActor(
		{ moduleName, actorName, instanceName, input, fn, request }: GetOrCreateAndCallOpts,
	): Promise<unknown> {
		// Create actor if needed
		if (!this.actorRegistry.has(await this.getId(moduleName, actorName, instanceName))) {
			await this.createActor({ moduleName, actorName, instanceName, input });
		}

		// Call actor
		const callRes = await this.callActor({ moduleName, actorName, instanceName, fn, request });

		return callRes;
	}

	async actorExists({ moduleName, actorName, instanceName }: ExistsOpts): Promise<boolean> {
		return this.actorRegistry.has(await this.getId(moduleName, actorName, instanceName));
	}

	private async getId(moduleName: string, actorName: string, instanceName: string) {
		const module = this.config.modules[moduleName];
		const actor = module.actors[actorName];
		const name = `%%${module.storageAlias}%%${actor.storageAlias}%%${instanceName}`;
		return await this.hash(name);
	}

	private async getEntry(moduleName: string, actorName: string, instanceName: string): Promise<ActorEntry> {
		const entry = this.actorRegistry.get(await this.getId(moduleName, actorName, instanceName));
		if (!entry) throw new Error("Actor not created");
		return entry;
	}

	/**
	 * Creates a new instance of actor.
	 *
	 * `init` is true if calling `initialize` and `state` is undefined.
	 */
	private constructActor(entry: ActorEntry, init: boolean) {
		// Create actor instance
		if (!init && entry.state === undefined) throw Error("actor state not initiated");

		// Get actor config
		if (!(entry.moduleName in this.config.modules)) throw new Error("module not found");
		const moduleConfig = this.config.modules[entry.moduleName];
		if (!(entry.actorName in moduleConfig.actors)) throw new Error("actor not found");
		const actorConfig = moduleConfig.actors[entry.actorName];

		// TODO: cache actor instance in memory
		// Run actor function
		const storage = new MemoryStorage(entry);
		const schedule = new MemorySchedule(this, entry);
		const state = entry.state ? JSON.parse(entry.state!) : undefined;
		const actor = new (actorConfig.actor)(storage, schedule, state);

		return actor;
	}

	private async hash(input: string) {
		const data = this.encoder.encode(input);
		const hash = await crypto.subtle.digest("SHA-256", data);
		const hashString = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");

		return hashString;
	}
}

export { MemoryActorDriver as ActorDriver };
