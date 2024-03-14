import { Command } from "../deps.ts";
import { GlobalOpts, initProject } from "../common.ts";
import { migrateDev } from "../../migrate/dev.ts";
import { migrateStatus } from "../../migrate/status.ts";
import { migrateDeploy } from "../../migrate/deploy.ts";
import { migrateReset } from "../../migrate/reset.ts";
import { CommandError, UserError } from "../../error/mod.ts";
import { Project } from "../../project/mod.ts";
import { verbose } from "../../term/status.ts";
import { getDatabaseUrl } from "../../utils/db.ts";

export const POSTGRES_IMAGE = "postgres:16.2-alpine3.19";
// Unique container name for this runtime so we can run multiple instances in
// parallel
export const POSTGRES_CONTAINER_NAME = `opengb-postgres-${Deno.pid}`;

export const dbCommand = new Command<GlobalOpts>()
	.description("Database commands");

dbCommand
	.globalOption("--env <environment:string>", "Managed OpenGB environment used by the Rivet CLI")
	.action(() => dbCommand.showHelp());

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

dbCommand
	.command("sh")
	.arguments("<module>")
	.action(async (opts, moduleName: string) => {
		// Validate terminal
		if (!Deno.stdin.isTerminal()) {
			throw new UserError("Cannot run this command without a terminal.", {
				suggest:
					"This is likely because you're running from a non-interactive shell, such as a CI environment. Run this command in a terminal that supports TTY.",
			});
		}

		const project = await initProject(opts);
		const module = resolveModules(project, [moduleName])[0];

		if (!module.db) throw new UserError(`Module does not have a database configured: ${name}`);

		const dbUrl = getDatabaseUrl(module.db.name).toString();

		// Start the container
		verbose("Starting container", `${POSTGRES_CONTAINER_NAME} (${POSTGRES_IMAGE})`);
		await new Deno.Command("docker", {
			args: [
				"run",
				"-it",
				"--rm",
				`--name=${POSTGRES_CONTAINER_NAME}`,
				"--add-host=host.docker.internal:host-gateway",
				POSTGRES_IMAGE,
				// ===
				"psql",
				dbUrl,
			],
			stdin: "inherit",
			stdout: "inherit",
			stderr: "inherit",
		}).output();
	});

dbCommand
	.command("url")
	.arguments("<module>")
	.action(async (opts, moduleName: string) => {
		const project = await initProject(opts);
		const module = resolveModules(project, [moduleName])[0];

		if (!module.db) throw new UserError(`Module does not have a database configured: ${name}`);

		const dbUrl = getDatabaseUrl(module.db.name).toString();

		await Deno.stdout.write(new TextEncoder().encode(dbUrl));
		console.error("");
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
