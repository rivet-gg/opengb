import { ModuleConfig, ScriptConfig } from "../config/module.ts";
import { ProjectConfig } from "../config/project.ts";
import { RegistryConfig } from "../config/project.ts";
import { resolve } from "../deps.ts";
import { hasUserConfigSchema, Project } from "../project/mod.ts";
import { camelify, pascalify } from "../types/case_conversions.ts";
import { AnySchemaElement } from "./schema/mod.ts";

export interface ProjectMeta {
	config: ProjectConfig;
	registries: Record<string, RegistryMeta>;
	modules: Record<string, ModuleMeta>;
}

export interface RegistryMeta {
	path: string;
	name: string;
	config: RegistryConfig;
	isExternal: boolean;
}

export interface ModuleMeta {
	path: string;
	name: string;
	nameCamel: string;
	namePascal: string;
	config: ModuleConfig;
	registryName: string;
	userConfig: unknown;
	userConfigSchema?: AnySchemaElement;
	scripts: Record<string, ScriptMeta>;
	db?: ModuleDatabaseMeta;
	hasUserConfigSchema: boolean;
}

export interface ModuleDatabaseMeta {
	name: string;
}

export interface ScriptMeta {
	path: string;
	name: string;
	nameCamel: string;
	namePascal: string;
	config: ScriptConfig;
	requestSchema: AnySchemaElement;
	responseSchema: AnySchemaElement;
}

/**
 * Generates meta file that can be consumed externally to get information about
 * this project. For example, this is used to auto-generate docs from external
 * tools.
 */
export async function generateMeta(project: Project) {
	const registries: Record<string, RegistryMeta> = Object.fromEntries(
		Array.from(project.registries.entries()).map(([name, registry]) => [name, {
			path: registry.path,
			name: name,
			config: registry.config,
			isExternal: registry.isExternal,
		}]),
	);

	const modules: Record<string, ModuleMeta> = {};
	for (const module of project.modules.values()) {
		modules[module.name] = {
			path: module.path,
			name: module.name,
			nameCamel: camelify(module.name),
			namePascal: pascalify(module.name),
			config: module.config,
			registryName: module.registry.name,
			userConfig: module.userConfig,
			userConfigSchema: module.userConfigSchema,
			scripts: Object.fromEntries(
				Array.from(module.scripts.entries()).map(([name, script]) => [name, {
					path: script.path,
					name: name,
					nameCamel: camelify(name),
					namePascal: pascalify(name),
					config: script.config,
					requestSchema: script.schemas?.request!,
					responseSchema: script.schemas?.response!,
				}]),
			),
			db: module.db,
			hasUserConfigSchema: await hasUserConfigSchema(module),
		};
	}

	const meta: ProjectMeta = {
		config: project.config,
		registries,
		modules,
	};

	await Deno.writeTextFile(
		resolve(project.path, "_gen", "meta.json"),
		JSON.stringify(meta, null, 4),
	);
}
