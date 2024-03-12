import { parse, resolve } from "../deps.ts";
import { Ajv } from "./deps.ts";
import schema from "../../artifacts/project_schema.json" with { type: "json" };
import { InternalError } from "../error/mod.ts";

export interface ProjectConfig extends Record<string, unknown> {
	registries: { [name: string]: RegistryConfig };
	modules: { [name: string]: ProjectModuleConfig };
}

export type RegistryConfig = { local: RegistryConfigLocal } | { git: RegistryConfigGit };

export interface RegistryConfigLocal {
	directory: string;

	/**
	 * If true, this will be treated like an external registry. This is
	 * important if multiple projects are using the same registry locally.
	 *
	 *  Modules from this directory will not be tested, formatted, linted, and
	 *  generate Prisma migrations.
	 */
	isExternal?: boolean;
}

export type RegistryConfigGit =
	& { url: RegistryConfigGitUrl; directory?: string }
	& ({ branch: string } | { tag: string } | { rev: string });

/**
 * The URL to the git repository.
 *
 * If both HTTPS and SSH URL are provided, they will both be tried and use the
 * one that works.
 */
export type RegistryConfigGitUrl = string | { https?: string; ssh?: string };

export interface ProjectModuleConfig extends Record<string, unknown> {
	/**
	 * The name of the registry to fetch the module from.
	 */
	registry?: string;

	/**
	 * Overrides the name of the module to fetch inside the registry.
	 */
	module?: string;

	/**
	 * The config that configures how this module is ran at runtime.
	 */
	config?: any;
}

// export async function readConfig(path: string): Promise<ProjectConfig> {
// 	const configRaw = await Deno.readTextFile(path);
// 	return parse(configRaw) as ProjectConfig;
// }

const projectConfigAjv = new Ajv.default({
	schemas: [schema],
});

export async function readConfig(projectPath: string): Promise<ProjectConfig> {
	// Read config
	const configRaw = await Deno.readTextFile(
		configPath(projectPath),
	);
	const config = parse(configRaw) as ProjectConfig;

	// Validate config
	const projectConfigSchema = projectConfigAjv.getSchema(
		"#/definitions/ProjectConfig",
	);
	if (!projectConfigSchema) {
		throw new InternalError("Failed to get project config schema");
	}
	if (!projectConfigSchema(config)) {
		throw new InternalError(
			`Invalid project config: ${JSON.stringify(projectConfigSchema.errors)}`,
		);
	}

	return config;
}

export function configPath(root: string): string {
	return resolve(root, "backend.yaml");
}
