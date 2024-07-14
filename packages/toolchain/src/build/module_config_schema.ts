import { Module, Project } from "../project/mod.ts";
import { runJob } from "../utils/worker_pool.ts";
import { WorkerRequest, WorkerResponse } from "./module_config_schema.worker.ts";
import { createWorkerPool } from "../utils/worker_pool.ts";
import { hasUserConfigSchema, mainConfigPath } from "../project/module.ts";
import { convertSerializedSchemaToZod, schemaElements } from "./schema/mod.ts";
import { ValidationError } from "../error/mod.ts";

const WORKER_POOL = createWorkerPool<WorkerRequest, WorkerResponse>({
	source: import.meta.resolve("./module_config_schema.worker.ts"),
});

export interface CompileModuleConfigSchemaOpts {
	strictSchemas: boolean;
	onStart: () => void;
}

export async function compileModuleConfigSchema(
	project: Project,
	module: Module,
	opts: CompileModuleConfigSchemaOpts,
): Promise<void> {
	// Read schema
	if (await hasUserConfigSchema(module)) {
		if (opts.strictSchemas) {
			// Parse schema
			const res = await runJob({ pool: WORKER_POOL, request: { module }, onStart: opts.onStart });
			module.userConfigSchema = res.moduleConfigSchema;
		} else {
			opts.onStart();

			// No schema
			module.userConfigSchema = schemaElements.any();
		}
	} else {
		opts.onStart();

		// No config
		module.userConfigSchema = schemaElements.any();
	}

	// Validate config
	const validation = convertSerializedSchemaToZod(module.userConfigSchema!);
	const result = await validation.safeParseAsync(module.userConfig);
	if (!result.success) {
		throw new ValidationError(`Invalid config for module "${module.name}".`, {
			validationError: result.error,
			path: mainConfigPath(project),
		});
	}
}
