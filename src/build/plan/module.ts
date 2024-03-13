import { BuildState, buildStep } from "../../build_state/mod.ts";
import { assertExists, resolve } from "../../deps.ts";
import { configPath, Module, Project } from "../../project/mod.ts";
import { compileModuleHelper, compileModuleTypeHelper, compileTestHelper } from "../gen.ts";
import { compileModuleConfigSchema } from "../module_config_schema.ts";
import { planScriptBuild } from "./script.ts";
import { BuildOpts } from "../mod.ts";

export async function planModuleBuild(
	buildState: BuildState,
	project: Project,
	module: Module,
	opts: BuildOpts,
) {
	buildStep(buildState, {
		id: `module.${module.name}.parse`,
		name: "Parse",
		description: `config.ts`,
		module,
		condition: {
			// TODO: use tjs.getProgramFiles() to get the dependent files?
			files: opts.strictSchemas ? [configPath(module)] : [],
			expressions: {
				strictSchemas: opts.strictSchemas,
			},
		},
		delayedStart: true,
		async build({ onStart }) {
			// Compile schema
			//
			// This mutates `module`
			await compileModuleConfigSchema(project, module, { strictSchemas: opts.strictSchemas, onStart });
		},
		async alreadyCached() {
			// Read schema from cache
			const schema = buildState.cache.persist.moduleConfigSchemas[module.name];
			assertExists(schema);
			module.userConfigSchema = schema;
		},
		async finally() {
			assertExists(module.userConfigSchema);

			// Populate cache with response
			buildState.cache.persist.moduleConfigSchemas[module.name] = module.userConfigSchema;
		},
	});

	buildStep(buildState, {
		id: `module.${module.name}.generate.registry`,
		name: "Generate",
		description: `_gen/registry.d.ts`,
		module,
		condition: {
			files: [resolve(module.path, "module.yaml"), configPath(module)],
		},
		async build() {
			await compileModuleTypeHelper(project, module);
		},
	});

	buildStep(buildState, {
		id: `module.${module.name}.generate.mod`,
		name: "Generate",
		description: `_gen/mod.ts`,
		module,
		condition: {
			files: [resolve(module.path, "module.yaml"), configPath(module)],
			expressions: {
				db: !!module.db,
			},
		},
		async build() {
			await compileModuleHelper(project, module);
		},
	});

	buildStep(buildState, {
		id: `module.${module.name}.generate.test`,
		name: "Generate",
		description: `_gen/test.ts`,
		module,
		condition: {
			files: [resolve(module.path, "module.yaml"), configPath(module)],
			expressions: {
				db: !!module.db,
			},
		},
		async build() {
			await compileTestHelper(project, module);
		},
	});

	for (const script of module.scripts.values()) {
		await planScriptBuild(buildState, project, module, script, opts);
	}
}
