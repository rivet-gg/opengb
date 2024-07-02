/// <reference types="npm:@cloudflare/workers-types" />
import { DurableObject } from "cloudflare:workers";
import { CloudflareDurableObjectsStorage } from "./storage.ts";
import { CloudflareDurableObjectsSchedule } from "./schedule.ts";
import { ActorBase } from "../../actor.ts";
import { Config } from "../../../mod.ts";

const KEYS = {
	META: {
		MODULE: "meta:module",
		ACTOR: "meta:module",
		CREATED_AT: "__meta:created_at",
	},
	SCHEDULE: {
		SCHEDULE: "schedule:schedule",
		EVENT_PREFIX: "schedule:event:",
		event(id: string): string {
			return `${this.EVENT_PREFIX}${id}`;
		},
	},
	STATE: "state",
};

interface ScheduleState {
	// Sorted by timestamp asc
	events: ScheduleIndexEvent[];
}

interface ScheduleIndexEvent {
	timestamp: number;
	eventId: string;
}

interface ScheduleEvent {
	timestamp: number;
	fn: string;
	request: unknown;
}

// MARK: TODO:
interface InitOpts {
	module: string;
	actor: string;
	instance: string;
	input: any;
	ignoreAlreadyInitialized?: boolean;
}

interface GetOrCreateAndCallOpts {
	init: InitOpts;
	fn: string;
	request: unknown;
}

interface CallRpcOpts {
	fn: string;
	request: unknown;
}

/*
 * __GlobalDurableObject type used for referencing an instance of the class.
 */
export interface __GlobalDurableObjectT extends DurableObject {
	constructActor(): Promise<ActorBase<unknown, unknown>>;
	init(opts: InitOpts): Promise<void>;
	initialized(): Promise<boolean>;
	getOrCreateAndCallRpc(opts: GetOrCreateAndCallOpts): Promise<any>;
	callRpc({ fn, request }: CallRpcOpts): Promise<any>;
	scheduleEvent(timestamp: number, fn: string, request: unknown): Promise<void>;
	alarm(): Promise<void>;
	get storage(): DurableObjectStorage;
}

/**
 * Generate a __GlobalDurableObject class that has access to the current config.
 *
 * We have to pass the config like this since the config's import is
 * dynamically generated in entrypoint.ts.
 *
 * Doing this instead of setting a static `__GlobalDurableObject.config = xxxx`
 * is better since it ensures that you _can't_ create an instance of
 * __GlobalDurableObject that doesn't have an associated config.
 */
export function buildGlobalDurableObjectClass(config: Config) {
	class __GlobalDurableObject extends DurableObject implements __GlobalDurableObjectT {
		// TODO: optimize to use in-memory state
		async constructActor(): Promise<ActorBase<unknown, unknown>> {
			// Create actor instance
			const storageRes = await this.ctx.storage.get<string>([KEYS.META.MODULE, KEYS.META.ACTOR, KEYS.STATE]);
			const moduleName = storageRes.get(KEYS.META.MODULE);
			const actorName = storageRes.get(KEYS.META.ACTOR);
			const state = storageRes.get(KEYS.STATE);
			if (moduleName == undefined || actorName == undefined) throw new Error("actor not initialized");
			if (state == undefined) throw Error("actor state not initiated");

			// Get actor config
			if (!(moduleName in config.modules)) throw new Error("module not found");
			const moduleConfig = config.modules[moduleName];
			if (!(actorName in moduleConfig.actors)) throw new Error("actor not found");
			const actorConfig = moduleConfig.actors[actorName];

			// TODO: cache actor instance in memory
			// TODO: use ctx.waitUntil for all calls
			// Run actor function
			const storage = new CloudflareDurableObjectsStorage(this);
			const schedule = new CloudflareDurableObjectsSchedule(this);
			const actor = new (actorConfig.actor)(storage, schedule, state);

			return actor;
		}

		async init(opts: InitOpts) {
			// Check if already initialized
			if (await this.initialized()) {
				if (!opts.ignoreAlreadyInitialized) throw new Error("already initialized");
			}

			// Store metadata
			await this.ctx.storage.put({
				[KEYS.META.MODULE]: opts.module,
				[KEYS.META.ACTOR]: opts.actor,
				[KEYS.META.CREATED_AT]: Date.now(),
			});

			// Build initial state
			const actor = await this.constructActor();
			const state = actor.initialize(opts.input);
			await this.ctx.storage.put(KEYS.STATE, state);
		}

		async initialized() {
			return await this.ctx.storage.get(KEYS.META.MODULE) != undefined;
		}

		async getOrCreateAndCallRpc(opts: GetOrCreateAndCallOpts): Promise<any> {
			await this.init({
				...opts.init,
				ignoreAlreadyInitialized: true,
			});

			return await this.callRpc({ fn: opts.fn, request: opts.request });
		}

		async callRpc({ fn, request }: CallRpcOpts): Promise<any> {
			const actor = await this.constructActor();

			// Call fn
			let callRes = (actor as any)[fn](request);
			if (callRes instanceof Promise) callRes = await callRes;

			// Update state
			await this.ctx.storage.put(KEYS.STATE, actor!.state);

			return callRes;
		}

		async scheduleEvent(timestamp: number, fn: string, request: unknown) {
			// Save event
			const eventId = crypto.randomUUID();
			await this.ctx.storage.put<ScheduleEvent>(KEYS.SCHEDULE.event(eventId), {
				timestamp,
				fn,
				request,
			});

			// Read index
			const schedule: ScheduleState = await this.ctx.storage.get(KEYS.SCHEDULE.SCHEDULE) ?? { events: [] };

			// Insert event in to index
			const newEvent: ScheduleIndexEvent = { timestamp, eventId };
			const insertIndex = schedule.events.findIndex((x) => x.timestamp > newEvent.timestamp);
			if (insertIndex === -1) {
				schedule.events.push(newEvent);
			} else {
				schedule.events.splice(insertIndex, 0, newEvent);
			}

			// Write new index
			await this.ctx.storage.put(KEYS.SCHEDULE.SCHEDULE, schedule);

			// Update alarm if:
			// - this is the newest event (i.e. at beginning of array) or
			// - this is the only event (i.e. the only event in the array)
			if (insertIndex == 0 || schedule.events.length == 1) {
				await this.ctx.storage.setAlarm(newEvent.timestamp);
			}
		}

		async alarm() {
			const now = Date.now();

			// Read index
			const scheduleIndex: ScheduleState = await this.ctx.storage.get(KEYS.SCHEDULE.SCHEDULE) ?? { events: [] };

			// Remove events from schedule
			const runIndex = scheduleIndex.events.findIndex((x) => x.timestamp > now);
			const scheduleIndexEvents = scheduleIndex.events.splice(0, runIndex + 1);

			// Find events to trigger
			const eventKeys = scheduleIndexEvents.map((x) => KEYS.SCHEDULE.event(x.eventId));
			const scheduleEvents = await this.ctx.storage.get<ScheduleEvent>(eventKeys);
			await this.ctx.storage.delete(eventKeys);

			// Write new schedule
			await this.ctx.storage.put(KEYS.SCHEDULE.SCHEDULE, scheduleIndex);

			// Set alarm for next event
			if (scheduleIndex.events.length > 0) {
				await this.ctx.storage.setAlarm(scheduleIndex.events[0].timestamp);
			}

			// Iterate by event key in order to ensure we call the events in order
			for (const eventKey of eventKeys) {
				const event = scheduleEvents.get(eventKey)!;
				try {
					// TODO: how do we handle this promise cleanly?
					this.callRpc({ fn: event.fn, request: event.request });
				} catch (err) {
					console.error("Failed to run scheduled event", err, event);
				}
			}
		}

		/**
		 * Make storage publicly accessible for use in `StorageDriver`.
		 */
		public get storage(): DurableObjectStorage {
			return this.ctx.storage;
		}
	}

	return __GlobalDurableObject;
}
