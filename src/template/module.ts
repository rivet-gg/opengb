import { UserError } from "../error/mod.ts";
import { ModuleConfig } from "../config/module.ts";
import { resolve, stringify } from "../deps.ts";
import { getLocalRegistry, Project } from "../project/mod.ts";
import { dedent } from "./deps.ts";

export async function templateModule(project: Project, moduleName: string) {
	const localRegistry = getLocalRegistry(project);
	if (!localRegistry) throw new UserError("No \`local\` registry found in backend.yaml.");
	const localModulesPath = localRegistry.path;

	if (project.modules.has(moduleName)) {
		throw new UserError("Module already exists.");
	}

	// Create directires
	const modulePath = resolve(localModulesPath, moduleName);
	await Deno.mkdir(modulePath);
	await Deno.mkdir(resolve(modulePath, "scripts"));
	await Deno.mkdir(resolve(modulePath, "tests"));
	await Deno.mkdir(resolve(modulePath, "db"));

	// Write default config
	const defaultModule: ModuleConfig = {
		scripts: {},
		errors: {},
	};
	await Deno.writeTextFile(
		resolve(modulePath, "module.yaml"),
		stringify(defaultModule),
	);

	// Write default config
	const defaultConfig = dedent`
		export interface Config {
			// Add your module configuration here
		}
	`;
	await Deno.writeTextFile(resolve(modulePath, "config.ts"), defaultConfig);

	// Write default migration
	const defaultSchema = dedent`
		datasource db {
			provider = "postgresql"
			url      = env("DATABASE_URL")
		}

		// Add your database schema here
	`;
	await Deno.writeTextFile(
		resolve(modulePath, "db", "schema.prisma"),
		defaultSchema,
	);

	// Add to backend.yaml
	const newConfig = structuredClone(project.config);
	newConfig.modules[moduleName] = {
		registry: "local",
	};
	await Deno.writeTextFile(
		resolve(project.path, "backend.yaml"),
		stringify(newConfig),
	);
}
