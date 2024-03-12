import { resolve } from "../../deps.ts";
import { Command } from "../deps.ts";
import { GlobalOpts, initProject } from "../common.ts";
import { build, DbDriver, Format, Runtime } from "../../build/mod.ts";
import { ensurePostgresRunning } from "../../utils/postgres_daemon.ts";
import { watch } from "../../watch/mod.ts";
import { Project } from "../../project/mod.ts";

export const devCommand = new Command<GlobalOpts>()
	.description("Start the development server")
	.option("--no-build", "Don't build source files")
	.option("--no-check", "Don't check source files before running")
	.option("--no-watch", "Automatically restart server on changes")
	.action(
		async (opts) => {
			const project = await initProject(opts);

			await ensurePostgresRunning(project);

			await watch(project, {
				disableWatch: !opts.watch,
				async fn(project: Project) {
					// Build project
					if (opts.build) {
						await build(project, {
							runtime: Runtime.Deno,
							format: Format.Native,
							dbDriver: DbDriver.NodePostgres,

							// This gets ran on `deno run`
							skipDenoCheck: true,
						});
					}

					// Determine args
					const args = [
						"--allow-env",
						"--allow-net",
						"--allow-read",
					];
					if (opts.check) args.push("--check");

					// Run entrypoint
					const cmd = await new Deno.Command("deno", {
						args: [
							"run",
							...args,
							resolve(project.path, "_gen", "entrypoint.ts"),
						],
						stdout: "inherit",
						stderr: "inherit",
					})
						.output();
					if (!cmd.success) throw new Error("Entrypoint failed");
				},
			});
		},
	);
