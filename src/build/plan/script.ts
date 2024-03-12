import { BuildState, buildStep } from "../../build_state/mod.ts";
import { assertExists, resolve } from "../../deps.ts";
import { Module, Project, Script } from "../../project/mod.ts";
import { compileScriptHelper } from "../gen.ts";
import { compileScriptSchema } from "../script_schema.ts";

export async function planScriptBuild(
	buildState: BuildState,
	project: Project,
	module: Module,
	script: Script,
) {
	buildStep(buildState, {
		name: "Parse",
		description: `modules/${module.name}/scripts/${script.name}.ts`,
		module,
		script,
		condition: {
			// TODO: This module and all of its dependent scripts. Use tjs.getProgramFiles() to get the dependent files?
			files: [
				// If the script is modified
				script.path,
			],
			expressions: {
				// If a script is added, removed, or the config is changed
				"module.scripts": module.scripts,
			},
		},
		delayedStart: true,
		async build({ onStart }) {
			// Compile schema
			//
			// This mutates `script`
			await compileScriptSchema(project, module, script, onStart);
		},
		async alreadyCached() {
			// Read schemas from cache
			const schemas = buildState.cache.persist.scriptSchemas[module.name][script.name];
			assertExists(schemas);
			script.requestSchema = schemas.request;
			script.responseSchema = schemas.response;
		},
		async finally() {
			assertExists(script.requestSchema);
			assertExists(script.responseSchema);

			// Populate cache with response
			if (!buildState.cache.persist.scriptSchemas[module.name]) {
				buildState.cache.persist.scriptSchemas[module.name] = {};
			}
			buildState.cache.persist.scriptSchemas[module.name][script.name] = {
				request: script.requestSchema,
				response: script.responseSchema,
			};
		},
	});

	buildStep(buildState, {
		name: "Generate",
		description: `modules/${module.name}/_gen/scripts/${script.name}.ts`,
		module,
		script,
		condition: {
			// TODO: check specifically scripts section of module config
			files: [resolve(module.path, "module.yaml"), script.path],
		},
		async build() {
			await compileScriptHelper(project, module, script);
		},
	});
}
