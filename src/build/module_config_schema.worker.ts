// Runs synchronise TypeScript code to derive the schema from a script in a
// background worker.

/// <reference no-default-lib="true" />
/// <reference lib="deno.worker" />

import { configPath, Module } from "../project/module.ts";
import { AnySchemaElement, createSchemaSerializer } from "./schema/mod.ts";

export interface WorkerRequest {
	module: Module;
}

export interface WorkerResponse {
	moduleConfigSchema: AnySchemaElement;
}

self.onmessage = async (ev) => {
	const { module } = ev.data as WorkerRequest;
	const moduleConfigPath = configPath(module);

	const { serialize } = createSchemaSerializer({ path: moduleConfigPath });

	self.postMessage({
		moduleConfigSchema: serialize("Config"),
	} as WorkerResponse);
};
