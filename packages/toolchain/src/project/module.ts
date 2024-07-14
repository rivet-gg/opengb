import { exists, relative, resolve } from "../deps.ts";
import { deepMerge, glob } from "./deps.ts";
import { configPath as moduleConfigPath, readConfig as readModuleConfig } from "../config/module.ts";
import { ModuleConfig } from "../config/module.ts";
import { Script } from "./script.ts";
import { Actor } from "./actor.ts";
import { Route } from "./route.ts";
import { Project, projectGenPath } from "./project.ts";
import { Registry } from "./registry.ts";
import { validateIdentifier } from "../types/identifiers/mod.ts";
import { Casing } from "../types/identifiers/defs.ts";
import { ProjectModuleConfig } from "../config/project.ts";
import { UserError } from "../error/mod.ts";
import { AnySchemaElement } from "../build/schema/mod.ts";
import { RouteConfig } from "../config/module.ts";

/**
 * Validates a path provided by the user.
 *
 * If the path is invalid, a {@linkcode UserError} is thrown, otherwise the
 * function returns nothing.
 *
 * Paths must:
 * - Start with a forward slash
 * - IF they are a prefix, end with a forward slash
 * - IF they are an exact path, NOT end with a forward slash
 *
 * @param configPath Where the (possibly) offending config file is located. This can be either the project config or module config.
 * @param path The user-provided http path
 * @param isPrefix Whether or not the path should be treated as a prefix
 * @throws {UserError} if the path is invalid
 */
function validatePath(
	configPath: string,
	path: string,
	isPrefix: boolean,
): void {
	// Ensure path starts with a forward slash
	if (!path.startsWith("/")) {
		throw new UserError(
			"Route paths must start with a forward slash",
			{
				path: configPath,
				details: `Got ${JSON.stringify(path)}`,
				suggest: `Change this to ${JSON.stringify("/" + path)}`,
			},
		);
	}

	const hasTrailingSlash = path.endsWith("/");
	if (isPrefix && !hasTrailingSlash) {
		throw new UserError(
			"Prefix paths must end with a forward slash",
			{
				path: configPath,
				details: `Got ${JSON.stringify(path)}`,
				suggest: `Change this to ${JSON.stringify(path + "/")}`,
			},
		);
	} else if (!isPrefix && hasTrailingSlash) {
		throw new UserError(
			"Exact paths must not end with a forward slash",
			{
				path: configPath,
				details: `Got ${JSON.stringify(path)}`,
				suggest: `Change this to ${JSON.stringify(path.replace(/\/$/, ""))}`,
			},
		);
	}
}

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
	userConfigSchema?: AnySchemaElement;

	storageAlias: string;

	scripts: Map<string, Script>;
	actors: Map<string, Actor>;
	routes: Map<string, Route>;
	db?: ModuleDatabase;

	// Cache
	_hasUserConfigSchema?: boolean;
}

export interface ModuleDatabase {
	/** Name of the Postgres schema the tables live in. */
	schema: string;
}

export async function loadModule(
	projectConfigPath: string,
	modulePath: string,
	name: string,
	projectModuleConfig: ProjectModuleConfig,
	registry: Registry,
	signal?: AbortSignal,
): Promise<Module> {
	signal?.throwIfAborted();

	// Read config
	const config = await readModuleConfig(modulePath);

	// Determine storage alias
	const storageAlias = projectModuleConfig.storageAlias ?? name;
	validateIdentifier(storageAlias, Casing.Snake);

	const scripts = await loadScripts(modulePath, config);
	const actors = await loadActors(modulePath, config);
	const routes = await loadRoutes(projectConfigPath, modulePath, config, name, projectModuleConfig);

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
		routes,
		db,
	};
}

async function loadScripts(modulePath: string, config: ModuleConfig) {
	// Find names of the expected scripts to find. Used to print error for extra scripts.
	const scriptsPath = resolve(modulePath, "scripts");
	const expectedScripts = new Set(
		await glob.glob("*.ts", { cwd: scriptsPath }),
	);

	// Read scripts
	const scripts = new Map<string, Script>();
	if (config.scripts) {
		for (const [scriptName, scriptConfig] of Object.entries(config.scripts)) {
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
				config: scriptConfig,
			};
			scripts.set(scriptName, script);

			// Remove script
			expectedScripts.delete(scriptName + ".ts");
		}
	}

	// Throw error extra scripts
	if (expectedScripts.size > 0) {
		const scriptList = Array.from(expectedScripts).map((x) => `- ${resolve(scriptsPath, x)}\n`);
		throw new UserError(
			`Found extra scripts not registered in module.json.`,
			{ details: scriptList.join(""), suggest: "Add these scripts to the module.json file.", path: scriptsPath },
		);
	}

	return scripts;
}

async function loadActors(modulePath: string, config: ModuleConfig) {
	// Find names of the expected actors to find. Used to print error for extra actors.
	const actorsPath = resolve(modulePath, "actors");
	const expectedActors = new Set(
		await glob.glob("*.ts", { cwd: actorsPath }),
	);

	// Read actors
	const actors = new Map<string, Actor>();
	if (config.actors) {
		for (const [actorName, actorConfig] of Object.entries(config.actors)) {
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

			const storageAlias = actorConfig.storageAlias ?? actorName;
			validateIdentifier(storageAlias, Casing.Snake);

			const actor: Actor = {
				path: actorPath,
				name: actorName,
				storageAlias,
				config: actorConfig,
			};
			actors.set(actorName, actor);

			// Remove actor
			expectedActors.delete(actorName + ".ts");
		}
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

	return actors;
}

async function loadRoutes(
	projectConfigPath: string,
	modulePath: string,
	config: ModuleConfig,
	moduleName: string,
	projectModuleConfig: ProjectModuleConfig,
) {
	// Read routes
	const routesPath = resolve(modulePath, "routes");
	const expectedRoutes = new Set(
		await glob.glob("*.ts", { cwd: resolve(modulePath, "routes") }),
	);

	const routes = new Map<string, Route>();
	if (config.routes) {
		let rawPathPrefix: string;
		if (projectModuleConfig.routes?.pathPrefix) {
			validatePath(
				projectConfigPath,
				projectModuleConfig.routes.pathPrefix,
				true,
			);

			rawPathPrefix = projectModuleConfig.routes.pathPrefix;
		} else {
			// Default to /modules/{module}/route/ for the path prefix
			const prefix = `/modules/${moduleName}/route/`;
			validatePath(
				projectConfigPath,
				prefix,
				true,
			);

			rawPathPrefix = prefix;
		}

		// Remove the trailing slash
		const pathPrefix = rawPathPrefix.replace(/\/$/, "");

		for (const [routeName, relativeRouteConfig] of Object.entries(config.routes)) {
			validateIdentifier(routeName, Casing.Snake);

			// Load script
			const routeScriptPath = resolve(
				routesPath,
				routeName + ".ts",
			);
			if (!await exists(routeScriptPath)) {
				throw new UserError(
					`Route not found at ${relative(Deno.cwd(), routeScriptPath)}.`,
					{
						suggest: "Check the routes in the module.yaml are configured correctly.",
						path: moduleConfigPath(modulePath),
					},
				);
			}

			// Get subpath (either path or pathPrefix)
			let subpath: string;
			if ("path" in relativeRouteConfig) {
				validatePath(
					moduleConfigPath(modulePath),
					relativeRouteConfig.path,
					false,
				);

				// Remove leading slash
				subpath = relativeRouteConfig.path.replace(/^\//, "");
			} else {
				validatePath(
					moduleConfigPath(modulePath),
					relativeRouteConfig.pathPrefix,
					true,
				);

				// Remove leading and trailing slashes
				subpath = relativeRouteConfig.pathPrefix.replace(/^\//, "").replace(/\/$/, "");
			}

			// Create route config with absolute path
			let routeConfig: RouteConfig;
			if ("path" in relativeRouteConfig) {
				routeConfig = {
					...relativeRouteConfig,
					path: `${pathPrefix}/${subpath}`,
				};
			} else {
				routeConfig = {
					...relativeRouteConfig,
					pathPrefix: `${pathPrefix}/${subpath}`,
				};
			}

			const route: Route = {
				path: routesPath,
				name: routeName,
				config: routeConfig,
			};
			routes.set(routeName, route);

			// Remove script
			expectedRoutes.delete(routeName + ".ts");
		}
	}

	// Throw error extra routes
	if (expectedRoutes.size > 0) {
		const routeList = Array.from(expectedRoutes).map((x) => `- ${resolve(routesPath, x)}\n`);
		throw new UserError(
			`Found extra routes not registered in module.yaml.`,
			{ details: routeList.join(""), suggest: "Add these routes to the module.yaml file.", path: routesPath },
		);
	}

	return routes;
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

export function moduleGenPath(project: Project, module: Module, ...pathSegments: string[]): string {
	return projectGenPath(project, "modules", module.name, ...pathSegments);
}

export function publicPath(module: Module): string {
	return resolve(module.path, "public.ts");
}

export function testGenPath(project: Project, module: Module): string {
	return moduleGenPath(
		project,
		module,
		"test.ts",
	);
}

export function typeGenPath(project: Project, module: Module): string {
	return moduleGenPath(
		project,
		module,
		"registry.d.ts",
	);
}

export function moduleGenRegistryMapPath(project: Project, module: Module): string {
	return moduleGenPath(
		project,
		module,
		"registryMap.ts",
	);
}

export function configPath(module: Module): string {
	return resolve(module.path, "config.ts");
}

export function mainConfigPath(project: Project): string {
	return resolve(project.path, "backend.json");
}

export async function hasUserConfigSchema(module: Module): Promise<boolean> {
	if (module._hasUserConfigSchema === undefined) {
		module._hasUserConfigSchema = await exists(configPath(module));
	}

	return module._hasUserConfigSchema;
}
