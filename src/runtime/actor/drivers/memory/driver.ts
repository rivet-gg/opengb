// This file is only imported when the runtime is `deno`
//
import { Config } from "../../../mod.ts";
import { ActorDriver } from "../../driver.ts";
import { Schedule } from "./schedule.ts";
import { Storage } from "./storage.ts";

const ENCODER = new TextEncoder();
const ACTOR_REGISTRY: Map<string, ActorEntry> = new Map();

export interface ActorEntry {
	moduleName: string;
	actorName: string;
	instanceName: string;
	state?: string;
	storage: Map<string, string>;
}

export const ACTOR_DRIVER: ActorDriver = {
	config: undefined as unknown as Config,
	async createActor({ moduleName, actorName, instanceName, input }): Promise<void> {
		const id = await getId(moduleName, actorName, instanceName);

		// Ensure doesn't already exist
		if (ACTOR_REGISTRY.has(await getId(moduleName, actorName, instanceName))) throw new Error("actor already created");

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
		const actor = constructActor(actorEntry);
		let initRes = actor.initialize(input);
		if (initRes instanceof Promise) initRes = await initRes;

		// Save state
		actorEntry.state = JSON.stringify(initRes);

		// Save actor
		ACTOR_REGISTRY.set(id, actorEntry);
	},
	async callActor({ moduleName, actorName, instanceName, fn, request }): Promise<unknown> {
		const entry = await getEntry(moduleName, actorName, instanceName);
		const actor = constructActor(entry);

		// Run actor function
		let callRes = (actor as any)[fn](request);
		if (callRes instanceof Promise) callRes = await callRes;

		// Save state
		entry.state = JSON.stringify(actor.state);

		return callRes;
	},
	async getOrCreateAndCallActor({ moduleName, actorName, instanceName, input, fn, request }): Promise<unknown> {
		// Create actor if needed
		if (!ACTOR_REGISTRY.has(await getId(moduleName, actorName, instanceName))) {
			await this.createActor({ moduleName, actorName, instanceName, input });
		}

		// Call actor
		const callRes = await this.callActor({ moduleName, actorName, instanceName, fn, request });

		return callRes;
	},
	async actorExists({ moduleName, actorName, instanceName }): Promise<boolean> {
		return ACTOR_REGISTRY.has(await getId(moduleName, actorName, instanceName));
	},
};

async function getId(moduleName: string, actorName: string, label: string) {
	const storageId = ACTOR_DRIVER.config.modules[moduleName].actors[actorName].storageId;
	const name = `%%${storageId}%%${label}`;
	return await hash(name);
}

async function getEntry(moduleName: string, actorName: string, instanceName: string): Promise<ActorEntry> {
	const entry = ACTOR_REGISTRY.get(await getId(moduleName, actorName, instanceName));
	if (!entry) throw new Error("Actor not created");
	return entry;
}

function constructActor(entry: ActorEntry) {
	// Create actor instance
	if (entry.state === undefined) throw Error("actor state not initiated");

	// Get actor config
	if (!(entry.moduleName in ACTOR_DRIVER.config.modules)) throw new Error("module not found");
	const moduleConfig = ACTOR_DRIVER.config.modules[entry.moduleName];
	if (!(entry.actorName in moduleConfig.actors)) throw new Error("actor not found");
	const actorConfig = moduleConfig.actors[entry.actorName];

	// TODO: cache actor instance in memory
	// Run actor function
	const storage = new Storage(entry);
	const schedule = new Schedule(entry);
	const actor = new (actorConfig.actor)(storage, schedule, entry.state);

	return actor;
}

async function hash(input: string) {
	const data = ENCODER.encode(input);
	const hash = await crypto.subtle.digest("SHA-256", data);
	const hashString = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");

	return hashString;
}
