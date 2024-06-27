import { exists, relative, resolve } from "../deps.ts";
import { deepMerge, glob, tjs } from "./deps.ts";
import { configPath as moduleConfigPath, readConfig as readModuleConfig } from "../config/module.ts";
import { ModuleConfig } from "../config/module.ts";
import { Script } from "./script.ts";
import { Actor } from "./actor.ts";
import { Route } from "./route.ts";
import { Project } from "./project.ts";
import { Registry } from "./registry.ts";
import { validateIdentifier } from "../types/identifiers/mod.ts";
import { Casing } from "../types/identifiers/defs.ts";
import { configPath as projectConfigPath, ProjectModuleConfig } from "../config/project.ts";
import { UserError } from "../error/mod.ts";
import { RouteConfig } from "../config/module.ts";

/**
 * Validates a path provided by the user.
 *
 * If the path is invalid, a {@linkcode UserError} is thrown, otherwise a version of
 * the path without leading or trailing slashes is returned.
 *
 * Paths must:
 * - Start with a forward slash
 * - IF they are a prefix, end with a forward slash
 * - IF they are an exact path, NOT end with a forward slash
 *
 * @param path The user-provided http path
 * @param isPrefix Whether or not the path should be treated as a prefix
 * @param configPath Where the (possibly) offending config file is located
 * @returns The path without any leading or trailing slashes
 * @throws {UserError} if the path is invalid
 */
function validateAndCleanPath(
	path: string,
	isPrefix: boolean,
	configPath: string,
): string {
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

	// Remove leading and trailing slashes
	return path.replace(/^\//, "").replace(/\/$/, "");
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
	userConfigSchema?: tjs.Definition;

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
	projectRoot: string,
	modulePath: string,
	name: string,
	projectModuleConfig: ProjectModuleConfig,
	registry: Registry,
	signal?: AbortSignal,
): Promise<Module> {
	signal?.throwIfAborted();

	// Read config
	const config = await readModuleConfig(modulePath);

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

	// ACTORS

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

		const actor: Actor = {
			path: actorPath,
			name: actorName,
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

	// ROUTES

	// Read routes
	const routesPath = resolve(modulePath, "routes");
	const expectedRoutes = new Set(
		await glob.glob("*.ts", { cwd: resolve(modulePath, "routes") }),
	);

	const routes = new Map<string, Route>();
	if (config.routes) {
		let pathPrefix: string;
		if (projectModuleConfig.routes?.pathPrefix) {
			pathPrefix = validateAndCleanPath(
				projectModuleConfig.routes.pathPrefix,
				true,
				projectConfigPath(projectRoot),
			);
		} else {
			// Default to /modules/{module}/route/ for the path prefix
			pathPrefix = validateAndCleanPath(
				`/modules/${name}/route/`,
				true,
				projectConfigPath(projectRoot),
			);
		}

		for (const routeName in config.routes) {
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

			// Get full route path (including module prefix)
			const relativeRouteConfig = config.routes[routeName];

			// Get subpath (either path or pathPrefix)
			let subpath: string;
			if ("path" in relativeRouteConfig) {
				subpath = validateAndCleanPath(
					relativeRouteConfig.path,
					false,
					moduleConfigPath(modulePath),
				);
			} else {
				subpath = validateAndCleanPath(
					relativeRouteConfig.pathPrefix,
					true,
					moduleConfigPath(modulePath),
				);
			}

			// Create route config with absolute path
			let routeConfig: RouteConfig;
			if ("path" in relativeRouteConfig) {
				routeConfig = {
					...relativeRouteConfig,
					path: `/${pathPrefix}/${subpath}`,
				};
			} else {
				routeConfig = {
					...relativeRouteConfig,
					pathPrefix: `/${pathPrefix}/${subpath}`,
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

	// Verify error names
	for (const errorName in config.errors) {
		validateIdentifier(errorName, Casing.Snake);
	}

	// Load db config
	let db: ModuleDatabase | undefined = undefined;
	if (await exists(resolve(modulePath, "db"), { isDirectory: true })) {
		db = {
			schema: `module_${name.replace("-", "_")}`,
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
		scripts,
		actors,
		routes,
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

export function moduleGenActorPath(
	_project: Project,
	module: Module,
): string {
	return resolve(
		module.path,
		"_gen",
		"actor.ts",
	);
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
