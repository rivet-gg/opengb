import { exists, join } from "../deps.ts";
import { readConfig as readProjectConfig } from "../config/project.ts";
import { ProjectConfig } from "../config/project.ts";
import { loadModule, Module } from "./module.ts";
import { RegistryConfig } from "../config/project.ts";
import { ProjectModuleConfig } from "../config/project.ts";

export interface Project {
  path: string;
  projectConfig: ProjectConfig;
  modules: Map<string, Module>;
}

export interface LoadProjectOpts {
  path?: string;
}

export async function loadProject(opts: LoadProjectOpts): Promise<Project> {
  const projectRoot = join(Deno.cwd(), opts.path ?? ".");

  console.log("Loading project", projectRoot);

  // Read project config
  const projectConfig = await readProjectConfig(
    projectRoot,
  );

  // Load modules
  const modules = new Map();
  for (const projectModuleName in projectConfig.modules) {
    const modulePath = await fetchAndResolveModule(
      projectRoot,
      projectConfig,
      projectModuleName,
    );
    const module = await loadModule(modulePath, projectModuleName);
    modules.set(projectModuleName, module);
  }

  // prepare ogs directory
  await Deno.mkdirSync(join(projectRoot, ".ogs"), { recursive: true });
  await Deno.writeTextFile(
    join(projectRoot, ".ogs", ".gitignore"),
    "**\n!.gitignore\n",
  );

  return { path: projectRoot, projectConfig, modules };
}

/**
 * Clones a registry to the local machine if required and returns the path.
 */
async function fetchAndResolveRegistry(
  projectRoot: string,
  registry: RegistryConfig,
): Promise<string> {
  // TODO: Impl git cloning
  if (!registry.directory) throw new Error("Registry directory not set");
  const registryPath = join(projectRoot, registry.directory);
  if (!await exists(registryPath)) {
    throw new Error(`Registry not found at ${registryPath}`);
  }
  return registryPath;
}

/**
 * Clones a registry to a local machine and resovles the path to the module.
 */
async function fetchAndResolveModule(
  projectRoot: string,
  projectConfig: ProjectConfig,
  moduleName: string,
): Promise<string> {
  // Lookup module
  const module = projectConfig.modules[moduleName];
  if (!module) throw new Error(`Module not found ${moduleName}`);

  // Lookup registry
  const registryName = registryForModule(module);
  const registryConfig = projectConfig.registries[registryName];
  if (!registryConfig) {
    throw new Error(`Registry ${registryName} not found for module ${module}`);
  }
  const registryPath = await fetchAndResolveRegistry(
    projectRoot,
    registryConfig,
  );

  // Resolve module path
  const pathModuleName = moduleNameInRegistry(moduleName, module);
  const modulePath = join(registryPath, pathModuleName);
  if (await exists(join(modulePath, "module.yaml"))) {
    return modulePath;
  } else {
    if (pathModuleName != moduleName) {
      // Has alias
      throw new Error(
        `Module ${pathModuleName} (alias of ${moduleName}) not found in registry ${registryName}`,
      );
    } else {
      // No alias
      throw new Error(
        `Module ${pathModuleName} not found in registry ${registryName}`,
      );
    }
  }
}

function registryForModule(module: ProjectModuleConfig): string {
  return module.registry ?? "default";
}

function moduleNameInRegistry(
  moduleName: string,
  module: ProjectModuleConfig,
): string {
  return module.module ?? moduleName;
}

export function genRuntimePath(project: Project): string {
	return join(project.path, "_gen", "runtime");
}

export function genRuntimeModPath(project: Project): string {
	return join(project.path, "_gen", "runtime", "src", "runtime", "mod.ts");
}
