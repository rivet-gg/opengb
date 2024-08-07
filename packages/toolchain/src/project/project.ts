import { assert, copy, emptyDir, exists, resolve } from "../deps.ts";
import { glob } from "./deps.ts";
import { readConfig as readProjectConfig } from "../config/project.ts";
import { ProjectConfig } from "../config/project.ts";
import { loadModule, Module } from "./module.ts";
import { loadRegistry, Registry } from "./registry.ts";
import { ProjectModuleConfig } from "../config/project.ts";
import { validateIdentifier } from "../types/identifiers/mod.ts";
import { Casing } from "../types/identifiers/defs.ts";
import { UnreachableError, UserError } from "../error/mod.ts";
import { Runtime } from "../build/mod.ts";
import { PathResolver, QualifiedPathPair } from "../../../path_resolver/src/mod.ts";
import { RouteCollisionError } from "../error/mod.ts";
import { dirname } from "../deps.ts";

export interface Project {
	path: string;
	configPath: string;
	config: ProjectConfig;
	registries: Map<string, Registry>;
	modules: Map<string, Module>;
}

export interface LoadProjectOpts {
	/** Path to the project root or project config. */
	project?: string;
}

/**
 * Resolves the input to the backend config path.
 *
 * The project directory path can be resolved from the dirname on this path.
 */
export function loadProjectConfigPath(opts: LoadProjectOpts): string {
	const path = resolve(Deno.cwd(), opts.project ?? ".");
	if (path.endsWith(".json")) {
		return path;
	} else {
		return resolve(path, "backend.json");
	}
}

export async function loadProject(opts: LoadProjectOpts, signal?: AbortSignal): Promise<Project> {
	const projectConfigPath = loadProjectConfigPath(opts);
	const projectRoot = dirname(projectConfigPath);

	// Read project config
	const projectConfig = await readProjectConfig(
		projectConfigPath,
	);

	// Load registries
	const registries = new Map();

	for (const [registryName, registryConfig] of Object.entries(projectConfig.registries)) {
		const registry = await loadRegistry(
			projectRoot,
			registryName,
			registryConfig,
			signal,
		);
		registries.set(registryName, registry);
	}

	if (!registries.has("default")) {
		throw new UserError("No default registry found.", {
			path: projectConfigPath,
			details: "Add this to your backend.json:\n\n" +
				'  "registries": {\n' +
				'    "default": { "github": "https://github.com/rivet-gg/opengb-modules.git" }\n' +
				"  }\n",
		});
	}

	// Validate local registry
	const localRegistry = registries.get("local");
	if (localRegistry) {
		if (!("local" in localRegistry.config)) {
			throw new UserError("Registry named `local` is special and must be configured as a local registry.", {
				path: projectConfigPath,
			});
		}
		if (localRegistry.isExternal) {
			throw new UserError("Registry named `local` is special and can't be external.", {
				path: projectConfigPath,
			});
		}
	}

	// Load modules
	const modules = new Map<string, Module>();
	for (const [projectModuleName, projectModuleConfig] of Object.entries(projectConfig.modules)) {
		const { path, registry } = await fetchAndResolveModule(
			projectRoot,
			projectConfigPath,
			registries,
			projectModuleName,
			projectModuleConfig,
		);
		const module = await loadModule(projectConfigPath, path, projectModuleName, projectModuleConfig, registry, signal);
		modules.set(projectModuleName, module);
	}

	// Verify uniqueness of storage alias
	for (const moduleA of modules.values()) {
		for (const moduleB of modules.values()) {
			if (moduleA.name != moduleB.name && moduleA.storageAlias == moduleB.storageAlias) {
				throw new UserError("Duplicate module storage alias.", {
					details: `Conflicting modules for alias ${moduleA.storageAlias}: ${moduleA.name}, ${moduleB.name}`,
					path: projectConfigPath,
				});
			}
		}
	}

	// Verify existence of module dependencies
	const missingDepsByModule = new Map<string, string[]>();
	for (const module of modules.values()) {
		const missingDeps = [] as string[];
		for (const dependencyName in module.config.dependencies) {
			const dependencyModule = modules.get(dependencyName);
			if (!dependencyModule) {
				missingDeps.push(dependencyName);
			}
		}

		if (missingDeps.length > 0) {
			missingDepsByModule.set(module.name, missingDeps);
		}
	}

	if (missingDepsByModule.size > 0) {
		let details = "";
		for (const [moduleName, missingDeps] of missingDepsByModule) {
			details += `Cannot resolve dependencies for ${moduleName}: ${missingDeps.join(", ")}\n`;
		}
		throw new UserError("Unresolved module dependencies.", {
			details,
			path: projectConfigPath,
		});
	}

	// Module can't depend on itself
	const selfDepModules = [] as string[];
	for (const module of modules.values()) {
		if (module.config.dependencies?.[module.name]) {
			selfDepModules.push(module.name);
		}
	}

	if (selfDepModules.length > 0) {
		let details = "";
		for (const moduleName of selfDepModules) {
			details += `Module ${moduleName} can't depend on itself\n`;
		}
		throw new UserError("Modules can't depend on themselves.", {
			details,
			path: projectConfigPath,
		});
	}

	// Verify routes don't conflict
	const routes: QualifiedPathPair[] = [];
	for (const [moduleName, module] of modules.entries()) {
		for (const [routeName, route] of module.routes.entries()) {
			const isPrefix = "pathPrefix" in route.config;
			const path = "pathPrefix" in route.config ? route.config.pathPrefix : route.config.path;
			routes.push({
				module: moduleName,
				route: routeName,
				path: { isPrefix, path },
			});
		}
	}

	const collisions = new PathResolver(routes).collisions;
	if (collisions.length > 0) throw new RouteCollisionError(collisions);

	return {
		path: projectRoot,
		configPath: projectConfigPath,
		config: projectConfig,
		registries,
		modules,
	};
}

interface FetchAndResolveModuleOutput {
	/**
	 * Path the module was copied to in .opengb.
	 */
	path: string;

	/**
	 * Path to the original module source code.
	 */
	sourcePath: string;

	/**
	 * Registry the module was fetched from.
	 */
	registry: Registry;
}

/**
 * Clones a registry to a local machine and resolves the path to the module.
 */
export async function fetchAndResolveModule(
	projectRoot: string,
	projectConfigPath: string,
	registries: Map<string, Registry>,
	moduleName: string,
	module: ProjectModuleConfig,
): Promise<FetchAndResolveModuleOutput> {
	validateIdentifier(moduleName, Casing.Snake);

	// Lookup registry
	const registryName = registryNameForModule(module);
	const registry = registries.get(registryName);
	if (!registry) {
		throw new UserError(`Registry \`${registryName}\` not found for module \`${module}\`.`, {
			path: projectConfigPath,
		});
	}

	// Resolve module path
	const pathModuleName = moduleNameInRegistry(moduleName, module);
	const sourcePath = resolve(registry.path, pathModuleName);
	if (!await exists(resolve(sourcePath, "module.json"))) {
		if (pathModuleName != moduleName) {
			// Has alias
			throw new UserError(
				`Module \`${pathModuleName}\` (alias of \`${moduleName}\`) not found in registry \`${registryName}\`.`,
				{ path: projectConfigPath },
			);
		} else {
			// No alias
			throw new UserError(
				`Module \`${pathModuleName}\` not found in registry \`${registryName}\`.`,
				{ path: projectConfigPath },
			);
		}
	}

	let path: string;
	if (registry.isExternal) {
		// Copy to gen dir
		//
		// We do this so generate files into the gen dir without modifying the
		// original module. For example. if multiple projects are using the same
		// local registry, we don't want conflicting generated files.
		path = resolve(
			projectRoot,
			".opengb",
			"external_modules",
			moduleName,
		);

		// HACK: Copy gen file to temp dir to avoid overwriting it
		const genPath = resolve(path, "module.gen.ts");
		let tempGenDir: string | undefined;
		let tempGenPath: string | undefined;
		if (await exists(genPath, { isFile: true })) {
			tempGenDir = await Deno.makeTempDir();
			tempGenPath = resolve(tempGenDir, "module.gen.ts");
			await copy(genPath, tempGenPath, { overwrite: true });
		}

		// TODO: Only copy when needed, this copies every time the CLI is ran
		await emptyDir(path);
		await copy(sourcePath, path, { overwrite: true });

		// HACK: Restore gen file
		if (tempGenDir && tempGenPath) {
			// Cannot `move` from a temp dir because /tmp might be in a
			// different file system
			await copy(tempGenPath, genPath, { overwrite: true });
			await Deno.remove(tempGenDir, { recursive: true });
		}
	} else {
		// Use original path
		path = sourcePath;
	}

	return { path, sourcePath: sourcePath, registry };
}

function registryNameForModule(module: ProjectModuleConfig): string {
	return module.registry ?? "default";
}

function moduleNameInRegistry(
	moduleName: string,
	module: ProjectModuleConfig,
): string {
	return module.module ?? moduleName;
}

export const GITIGNORE_PATH = ".gitignore";
export const RUNTIME_CONFIG_PATH = "runtime_config.ts";
export const ENTRYPOINT_PATH = "entrypoint.ts";
export const BUNDLE_PATH = "output.js";
export const MANIFEST_PATH = "manifest.json";
export const META_PATH = "meta.json";
export const OPEN_API_PATH = "openapi.json";
export const CACHE_PATH = "cache.json";
export const RUNTIME_PATH = "runtime";
export const PRISMA_WORKSPACE_PATH = "prisma_workspace";
export const SDK_PATH = "sdk";

export function projectGenPath(project: Project, ...pathSegments: string[]): string {
	return resolve(project.path, ".opengb", ...pathSegments);
}

export function genRuntimeModPath(project: Project): string {
	return projectGenPath(project, "runtime", "packages", "runtime", "src", "mod.ts");
}

export function genRuntimeActorPath(project: Project): string {
	return projectGenPath(project, "runtime", "packages", "runtime", "src", "actor", "actor.ts");
}

export function genRuntimeActorDriverPath(project: Project, runtime: Runtime): string {
	let actorDriverName: string;
	if (runtime == Runtime.Deno) {
		actorDriverName = "memory";
	} else if (runtime == Runtime.CloudflareWorkersPlatforms) {
		actorDriverName = "cloudflare_durable_objects";
	} else {
		throw new UnreachableError(runtime);
	}

	return projectGenPath(
		project,
		"runtime",
		"packages",
		"runtime",
		"src",
		"actor",
		"drivers",
		actorDriverName,
		"driver.ts",
	);
}

export function genDependencyTypedefPath(project: Project): string {
	return projectGenPath(project, "dependencies.d.ts");
}
export function genDependencyCaseConversionMapPath(project: Project): string {
	return projectGenPath(project, "dependencyCaseConversion.ts");
}

export function genActorTypedefPath(project: Project): string {
	return projectGenPath(project, "actors.d.ts");
}
export function genActorCaseConversionMapPath(project: Project): string {
	return projectGenPath(project, "actorCaseConversion.ts");
}

function genPublicUtilsFolder(project: Project): string {
	return projectGenPath(project, "public");
}

/**
 * Inner file used to nest any imports related to this module.
 *
 * This will be re-imported in other `genModulePublicExternal`.
 */
export function genModulePublicInternal(project: Project, module: Module): string {
	return resolve(genPublicUtilsFolder(project), `internal_${module.name}.ts`);
}

/**
 * File that gets imported as `Module` in the module.gen.ts.
 *
 * This exports the dependencies (the `genModulePublicInternal` files) with
 * their given module names.
 */
export function genModulePublicExternal(project: Project, module: Module): string {
	return resolve(genPublicUtilsFolder(project), `external_${module.name}.ts`);
}

function genDependenciesFolder(project: Project): string {
	return projectGenPath(project, "dependencies");
}

export function genModuleDependenciesPath(project: Project, module: Module): string {
	return resolve(genDependenciesFolder(project), `dependencies_${module.name}.ts`);
}

export function genPrismaOutputFolder(project: Project, module: Module): string {
	return projectGenPath(project, "prisma_output", module.name);
}

/**
 * Final processed JavaScript bundle that can be used to interact with the database.
 */
export function genPrismaOutputBundle(project: Project, module: Module): string {
	return resolve(genPrismaOutputFolder(project, module), "esm.js");
}

export interface ListSourceFileOpts {
	/**
	 * Only include local files.
	 *
	 * Useful for commands that are only relevant to modules written by the user.
	 */
	localOnly?: boolean;
}

/**
 * List all paths to TypeScript files in the project.
 */
export async function listSourceFiles(
	project: Project,
	opts: ListSourceFileOpts = {},
): Promise<string[]> {
	const files: string[] = [];
	for (const module of project.modules.values()) {
		// Skip non-local files
		if (opts.localOnly && module.registry.isExternal) continue;

		const moduleFiles = (await glob.glob("**/*.ts", { cwd: module.path, ignore: ".opengb/**" }))
			.map((x) => resolve(module.path, x));
		files.push(...moduleFiles);
	}
	return files;
}

export async function cleanProject(project: Project) {
	await Deno.remove(projectGenPath(project), { recursive: true });
}

export function getDefaultRegistry(project: Project): Registry | undefined {
	return project.registries.get("default");
}

export function getLocalRegistry(
	project: Project,
): Registry | undefined {
	const localRegistry = project.registries.get("local");
	if (localRegistry) {
		assert("local" in localRegistry.config);
		assert(!localRegistry.isExternal);
		return localRegistry;
	} else {
		return undefined;
	}
}
