import { BuildState, buildStep } from "../../build_state/mod.ts";
import { assertExists, resolve } from "../../deps.ts";
import { Module, Project, Script } from "../../project/mod.ts";
import { compileScriptHelper } from "../gen.ts";
import { BuildOpts } from "../mod.ts";
import { compileScriptSchema } from "../script_schema.ts";

export async function planScriptBuild(
	buildState: BuildState,
	project: Project,
	module: Module,
	script: Script,
	opts: BuildOpts,
) {
	buildStep(buildState, {
		id: `module.${module.name}.script.${script.name}.parse`,
		name: "Parse",
		description: `${script.name}.ts`,
		module,
		script,
		condition: {
			// TODO: use tjs.getProgramFiles() to get the dependent files?
			files: opts.strictSchemas ? [script.path] : [],
			expressions: {
				strictSchemas: opts.strictSchemas,

				// TODO: JSON.stringify is not deterministic nor fast
				// If a script is added, removed, or the config is changed
				moduleScripts: JSON.stringify(module.scripts),
			},
		},
		delayedStart: true,
		async build({ onStart }) {
			// Compile schema
			//
			// This mutates `script`
			await compileScriptSchema(project, module, script, { strictSchemas: opts.strictSchemas, onStart });
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
		id: `module.${module.name}.script.${script.name}.generate`,
		name: "Generate",
		description: `_gen/scripts/${script.name}.ts`,
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
