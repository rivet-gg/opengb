import { UserError } from "../error/mod.ts";
import { ModuleConfig } from "../config/module.ts";
import { resolve } from "../deps.ts";
import { getLocalRegistry, Project } from "../project/mod.ts";
import { dedent } from "./deps.ts";

export async function templateModule(project: Project, moduleName: string) {
	const localRegistry = getLocalRegistry(project);
	if (!localRegistry) throw new UserError("No \`local\` registry found in backend.json.");
	const localModulesPath = localRegistry.path;

	if (project.modules.has(moduleName)) {
		throw new UserError("Module already exists.");
	}

	// Create directories
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
		resolve(modulePath, "module.json"),
		JSON.stringify(defaultModule, null, "\t"),
	);

	// Write default migration
	const defaultSchema = dedent`
		// Do not modify this \`datasource\` block
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

	// Add to backend.json
	const newConfig = structuredClone(project.config);
	newConfig.modules[moduleName] = {
		registry: "local",
	};
	await Deno.writeTextFile(
		resolve(project.path, "backend.json"),
		JSON.stringify(newConfig, null, "\t"),
	);
}
