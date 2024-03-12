import { Ajv } from "./deps.ts";
import { Module, Project } from "../project/mod.ts";
import { runJob } from "../utils/worker_pool.ts";
import { WorkerRequest, WorkerResponse } from "./module_config_schema.worker.ts";
import { createWorkerPool } from "../utils/worker_pool.ts";
import { hasUserConfigSchema } from "../project/module.ts";
import { UserError } from "../error/mod.ts";
import { resolve } from "../deps.ts";

const WORKER_POOL = createWorkerPool<WorkerRequest, WorkerResponse>({
	source: import.meta.resolve("./module_config_schema.worker.ts"),
});

export async function compileModuleConfigSchema(
	_project: Project,
	module: Module,
	onStart: () => void,
): Promise<void> {
	// Read schema
	if (await hasUserConfigSchema(module)) {
		// Load config
		const res = await runJob({ pool: WORKER_POOL, request: { module }, onStart });
		module.userConfigSchema = res.moduleConfigSchema;
	} else {
		// No config
		module.userConfigSchema = {
			"$schema": "http://json-schema.org/draft-07/schema#",
			"$ref": "#/definitions/Config",
			"definitions": {
				"Config": {
					"type": "null",
				},
			},
		};
	}

	// Validate config
	const moduleConfigAjv = new Ajv.default({
		schemas: [module.userConfigSchema],
	});

	const moduleConfigSchema = moduleConfigAjv.getSchema(
		"#/definitions/Config",
	);
	if (!moduleConfigSchema) {
		throw new UserError("Type `Config` does not exist.", { path: resolve(module.path, "config.ts") });
	}

	if (!moduleConfigSchema(module.userConfig)) {
		throw new UserError(
			`Invalid module config.`,
			{
				details: `${JSON.stringify(moduleConfigSchema.errors, null, 2)}`,
			},
		);
	}
}
