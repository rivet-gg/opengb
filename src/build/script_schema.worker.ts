// Runs synchronise TypeScript code to derive the schema from a script in a
// background worker.

/// <reference no-default-lib="true" />
/// <reference lib="deno.worker" />
import { Script } from "../project/mod.ts";
import { AnySchemaElement, createSchemaSerializer } from "./schema/mod.ts";

export interface WorkerRequest {
	script: Script;
}

export interface WorkerResponse {
	response: AnySchemaElement;
	request: AnySchemaElement;
}

self.onmessage = async (ev) => {
	const { script } = ev.data as WorkerRequest;

	const { serialize } = createSchemaSerializer({ path: script.path });

	self.postMessage({
		response: serialize("Response"),
		request: serialize("Request"),
	} as WorkerResponse);
};
