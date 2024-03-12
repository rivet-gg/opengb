import { Command } from "../deps.ts";
import { GlobalOpts, initProject } from "../common.ts";
import { migrateDev } from "../../migrate/dev.ts";
import { migrateStatus } from "../../migrate/status.ts";
import { migrateDeploy } from "../../migrate/deploy.ts";
import { migrateReset } from "../../migrate/reset.ts";
import { UserError } from "../../error/mod.ts";
import { Project } from "../../project/mod.ts";

export const dbCommand = new Command<GlobalOpts>()
	.description("Database commands");

dbCommand.action(() => dbCommand.showHelp());

dbCommand
	.command("dev")
	.arguments("[...modules:string]")
	.option("-c, --create-only", "Create only", {
		default: false,
	})
	.action(async (opts, ...moduleNames: string[]) => {
		const project = await initProject(opts);
		const modules = resolveModules(project, moduleNames);

		// Validate modules
		for (const module of modules) {
			if (module.registry.isExternal) {
				throw new UserError(`Cannot run this command against external module: ${module.name}`);
			}
		}

		await migrateDev(project, modules, { createOnly: opts.createOnly });
	});

dbCommand
	.command("status")
	.arguments("[...modules:string]")
	.action(async (opts, ...moduleNames: string[]) => {
		const project = await initProject(opts);
		const modules = resolveModules(project, moduleNames);
		await migrateStatus(project, modules);
	});

dbCommand
	.command("reset")
	.arguments("[...modules:string]")
	.action(async (opts, ...moduleNames: string[]) => {
		const project = await initProject(opts);
		const modules = resolveModules(project, moduleNames);
		await migrateReset(project, modules);
	});

dbCommand
	.command("deploy")
	.arguments("[...modules:string]")
	.action(async (opts, ...moduleNames: string[]) => {
		const project = await initProject(opts);
		const modules = resolveModules(project, moduleNames);
		await migrateDeploy(project, modules);
	});

function resolveModules(project: Project, moduleNames: string[]) {
	if (moduleNames.length > 0) {
		return moduleNames.map((name) => {
			const module = project.modules.get(name);
			if (!module) throw new UserError(`Module not found: ${name}`);
			return module;
		});
	} else {
		return Array.from(project.modules.values());
	}
}

// TODO: https://github.com/rivet-gg/opengb-engine/issues/84
// TODO: https://github.com/rivet-gg/opengb-engine/issues/85
// dbCommand.command("sh").action(async () => {
// 	const cmd = await new Deno.Command("docker-compose", {
// 		args: ["exec", "-it", "postgres", "psql", "--username", "postgres"],
// 		stdin: "inherit",
// 		stdout: "inherit",
// 		stderr: "inherit",
// 	})
// 		.output();
// 	if (!cmd.success) throw new Error("Failed to sh in to database");
// });
