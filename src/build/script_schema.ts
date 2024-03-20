import { Module, Project, Script } from "../project/mod.ts";
import { runJob } from "../utils/worker_pool.ts";
import { WorkerRequest, WorkerResponse } from "./script_schema.worker.ts";
import { createWorkerPool } from "../utils/worker_pool.ts";
import { schemaElements } from "./schema/mod.ts";

const ANY_JSON_SCHEMA = {
	"$schema": "http://json-schema.org/draft-07/schema#",
	"type": "object",
	"additionalProperties": true,
};

const WORKER_POOL = createWorkerPool<WorkerRequest, WorkerResponse>({
	source: import.meta.resolve("./script_schema.worker.ts"),
});

export interface CompileScriptSchemaOpts {
	strictSchemas: boolean;
	onStart: () => void;
}

export async function compileScriptSchema(
	_project: Project,
	_module: Module,
	script: Script,
	opts: CompileScriptSchemaOpts,
): Promise<void> {
	if (opts.strictSchemas) {
		// Parse schema
		const res = await runJob({
			pool: WORKER_POOL,
			request: { script },
			onStart: opts.onStart,
		});

		// Deprecated
		script.requestSchema = ANY_JSON_SCHEMA;
		script.responseSchema = ANY_JSON_SCHEMA;

		script.schemas = {
			request: res.request,
			response: res.response,
		};
	} else {
		opts.onStart();

		// Deprecated
		script.requestSchema = ANY_JSON_SCHEMA;
		script.responseSchema = ANY_JSON_SCHEMA;

		script.schemas = {
			request: schemaElements.any(),
			response: schemaElements.any(),
		};
	}
}
