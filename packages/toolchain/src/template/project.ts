import { resolve } from "../deps.ts";
import { ProjectConfig } from "../config/project.ts";

export async function templateProject(rootPath: string) {
	await Deno.mkdir(rootPath, { recursive: true });

	// Create backend.json
	const defaultBackend: ProjectConfig = {
		registries: {
			default: { github: "rivet-gg/opengb-modules", tag: "v1.0.0-rc.1" },
		},
		modules: {
			users: {},
			rate_limit: {},
			tokens: {},
		},
	};
	await Deno.writeTextFile(
		resolve(rootPath, "backend.json"),
		JSON.stringify(defaultBackend, null, "\t"),
	);

	// Create modules directory
	await Deno.mkdir(resolve(rootPath, "modules"), { recursive: true });
}
