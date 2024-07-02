import { exists, relative, resolve } from "../deps.ts";
import { deepMerge, glob, tjs } from "./deps.ts";
import { configPath as moduleConfigPath, readConfig as readModuleConfig } from "../config/module.ts";
import { ModuleConfig } from "../config/module.ts";
import { Script } from "./script.ts";
import { Actor } from "./actor.ts";
import { Project } from "./project.ts";
import { Registry } from "./registry.ts";
import { validateIdentifier } from "../types/identifiers/mod.ts";
import { Casing } from "../types/identifiers/defs.ts";
import { ProjectModuleConfig } from "../config/project.ts";
import { UserError } from "../error/mod.ts";

export interface Module {
	/**
	 * The path to the cloned module in the project's .opengb directory.
	 *
	 * This path can be modified and will be discarded on the next codegen.
	 */
	path: string;
	name: string;

	/**
	 * Config from the backend.json file.
	 */
	projectModuleConfig: ProjectModuleConfig;

	/**
	 * Config from the module.json file.
	 */
	config: ModuleConfig;

	/**
	 * The registry that the module was pulled from.
	 */
	registry: Registry;

	/**
	 * The config passed to this module in the backend.json file.
	 */
	userConfig?: unknown;

	/**
	 * The schema for the module's config file.
	 *
	 * Generated from config.ts
	 */
	userConfigSchema?: tjs.Definition;

	storageAlias: string;

	scripts: Map<string, Script>;
	actors: Map<string, Actor>;
	db?: ModuleDatabase;

	// Cache
	_hasUserConfigSchema?: boolean;
}

export interface ModuleDatabase {
	/** Name of the Postgres schema the tables live in. */
	schema: string;
}

export async function loadModule(
	modulePath: string,
	name: string,
	projectModuleConfig: ProjectModuleConfig,
	registry: Registry,
	signal?: AbortSignal,
): Promise<Module> {
	signal?.throwIfAborted();

	// Read config
	const config = await readModuleConfig(modulePath);

	// Deterine storage alias
	const storageAlias = projectModuleConfig.storageAlias ?? name;
	validateIdentifier(storageAlias, Casing.Snake);

	// Find names of the expected scripts to find. Used to print error for extra scripts.
	const scriptsPath = resolve(modulePath, "scripts");
	const expectedScripts = new Set(
		await glob.glob("*.ts", { cwd: scriptsPath }),
	);

	// Read scripts
	const scripts = new Map<string, Script>();
	for (const scriptName in config.scripts) {
		validateIdentifier(scriptName, Casing.Snake);

		// Load script
		const scriptPath = resolve(
			scriptsPath,
			scriptName + ".ts",
		);
		if (!await exists(scriptPath)) {
			throw new UserError(
				`Script not found at ${relative(Deno.cwd(), scriptPath)}.`,
				{
					suggest: "Check the scripts in the module.json are configured correctly.",
					path: moduleConfigPath(modulePath),
				},
			);
		}

		const script: Script = {
			path: scriptPath,
			name: scriptName,
			config: config.scripts[scriptName],
		};
		scripts.set(scriptName, script);

		// Remove script
		expectedScripts.delete(scriptName + ".ts");
	}

	// Throw error extra scripts
	if (expectedScripts.size > 0) {
		const scriptList = Array.from(expectedScripts).map((x) => `- ${resolve(scriptsPath, x)}\n`);
		throw new UserError(
			`Found extra scripts not registered in module.json.`,
			{ details: scriptList.join(""), suggest: "Add these scripts to the module.json file.", path: scriptsPath },
		);
	}

	// Find names of the expected actors to find. Used to print error for extra actors.
	const actorsPath = resolve(modulePath, "actors");
	const expectedActors = new Set(
		await glob.glob("*.ts", { cwd: actorsPath }),
	);

	// Read actors
	const actors = new Map<string, Actor>();
	for (const actorName in config.actors) {
		validateIdentifier(actorName, Casing.Snake);

		// Load actor
		const actorPath = resolve(
			actorsPath,
			actorName + ".ts",
		);
		if (!await exists(actorPath)) {
			throw new UserError(
				`actor not found at ${relative(Deno.cwd(), actorPath)}.`,
				{
					suggest: "Check the actors in the module.json are configured correctly.",
					path: moduleConfigPath(modulePath),
				},
			);
		}

		const storageAlias = config.actors[actorName].storageAlias ?? actorName;
		validateIdentifier(storageAlias, Casing.Snake);

		const actor: Actor = {
			path: actorPath,
			name: actorName,
			storageAlias,
			config: config.actors[actorName],
		};
		actors.set(actorName, actor);

		// Remove actor
		expectedActors.delete(actorName + ".ts");
	}

	// Throw error extra actors
	if (expectedActors.size > 0) {
		const actorList = Array.from(expectedActors).map((x) => `- ${resolve(actorsPath, x)}\n`);
		throw new UserError(
			`Found extra actors not registered in module.json.`,
			{ details: actorList.join(""), suggest: "Add these actors to the module.json file.", path: actorsPath },
		);
	}

	// Verify uniqueness of storage alias
	for (const actorA of actors.values()) {
		for (const actorB of actors.values()) {
			if (actorA.name != actorB.name && actorA.storageAlias == actorB.storageAlias) {
				throw new UserError(`Duplicate actor storage alias in module ${config.name}.`, {
					details: `Conflicting actors for alias ${actorA.storageAlias}: ${actorA.name}, ${actorB.name}`,
					path: moduleConfigPath(modulePath),
				});
			}
		}
	}

	// Verify error names
	for (const errorName in config.errors) {
		validateIdentifier(errorName, Casing.Snake);
	}

	// Load db config
	let db: ModuleDatabase | undefined = undefined;
	if (await exists(resolve(modulePath, "db"), { isDirectory: true })) {
		db = {
			schema: `module_${storageAlias}`,
		};
	}

	// Merge user config with default config
	const userConfig = deepMerge(
		config.defaultConfig ?? {},
		projectModuleConfig.config ?? {},
		{
			arrays: "replace",
			maps: "merge",
			sets: "replace",
		},
	);

	return {
		path: modulePath,
		name,
		projectModuleConfig,
		userConfig,
		config,
		registry,
		storageAlias,
		scripts,
		actors,
		db,
	};
}

export function moduleHelperGen(
	_project: Project,
	module: Module,
): string {
	return resolve(
		module.path,
		"module.gen.ts",
	);
}

export function publicPath(module: Module): string {
	return resolve(module.path, "public.ts");
}

export function testGenPath(_project: Project, module: Module): string {
	return resolve(
		module.path,
		"_gen",
		"test.ts",
	);
}

export function typeGenPath(_project: Project, module: Module): string {
	return resolve(
		module.path,
		"_gen",
		"registry.d.ts",
	);
}

export function moduleGenRegistryMapPath(_project: Project, module: Module): string {
	return resolve(
		module.path,
		"_gen",
		"registryMap.ts",
	);
}

export function configPath(module: Module): string {
	return resolve(module.path, "config.ts");
}

export async function hasUserConfigSchema(module: Module): Promise<boolean> {
	if (module._hasUserConfigSchema === undefined) {
		module._hasUserConfigSchema = await exists(configPath(module));
	}

	return module._hasUserConfigSchema;
}
