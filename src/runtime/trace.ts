import { JsonObject } from "../types/json.ts";
import { BuildRuntime } from "./runtime.ts";

/**
 * Provides context about where this script call came from.
 */
export interface Trace extends JsonObject {
	rayId: string;
	entries: TraceEntry[];
}

/**
 * Single entry in the trace.
 */
export interface TraceEntry extends JsonObject {
	requestId: string;
	startedAt: string;
	type: TraceEntryType;
}

/**
 * Infomration about the type of the trace entry.
 */
export type TraceEntryType =
	| { httpRequest: TraceEntryTypeHttpRequest }
	| {
		script: TraceEntryTypeScript;
	}
	| { actorInitialize: TraceEntryTypeActorInitialize }
	| { actorCall: TraceEntryTypeActorCall }
	| { actorSchedule: TraceEntryTypeActorSchedule }
	| { test: TraceEntryTypeTest }
	| { internalTest: TraceEntryTypeInternalTest };

export interface TraceEntryTypeHttpRequest extends JsonObject {
	method: string;
	path: string;
	remoteAddress: string;
	headers: { [key: string]: string };
}

export interface TraceEntryTypeScript extends JsonObject {
	module: string;
	script: string;
}

export interface TraceEntryTypeActorInitialize extends JsonObject {
	module: string;
	actor: string;
}

export interface TraceEntryTypeActorCall extends JsonObject {
	module: string;
	actor: string;
	fn: string;
}

export interface TraceEntryTypeActorSchedule extends JsonObject {}

export interface TraceEntryTypeTest extends JsonObject {
	module: string;
	name: string;
}

export interface TraceEntryTypeInternalTest extends JsonObject {
}

export function newTrace(entryType: TraceEntryType, runtime: BuildRuntime = BuildRuntime.Deno): Trace {
	const entry: TraceEntry = {
		requestId: crypto.randomUUID(),
		startedAt: new Date().toISOString(),
		type: entryType,
	};

	// Read managed opengb ray id from request header (set by cloudflare)
	let rayId: string;
	if (runtime == BuildRuntime.Cloudflare && "httpRequest" in entry) {
		rayId = (entry.httpRequest as TraceEntryTypeHttpRequest).headers["x-opengb-ray-id"];
	} else {
		// Generate random ray ID
		rayId = crypto.randomUUID();
	}

	return {
		rayId,
		entries: [entry],
	};
}

/**
 * Returns a new trace with the given entry appended to it.
 */
export function appendTraceEntry(
	trace: Trace,
	entryType: TraceEntryType,
): Trace {
	const entry: TraceEntry = {
		requestId: crypto.randomUUID(),
		startedAt: new Date().toISOString(),
		type: entryType,
	};

	return {
		rayId: trace.rayId,
		entries: [...trace.entries, entry],
	};
}
