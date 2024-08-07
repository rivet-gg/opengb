import { Command } from "../deps.ts";
import { GlobalOpts } from "../common.ts";
import { build, DbDriver, Format, Runtime } from "../../../toolchain/src/build/mod.ts";
import { ensurePostgresRunning } from "../../../toolchain/src/utils/postgres_daemon.ts";
import { watch } from "../../../toolchain/src/watch/mod.ts";
import { Project } from "../../../toolchain/src/project/mod.ts";
import { InternalError } from "../../../toolchain/src/error/mod.ts";
import { ENTRYPOINT_PATH, projectGenPath } from "../../../toolchain/src/project/project.ts";

export const devCommand = new Command<GlobalOpts>()
	.description("Start the development server")
	.option("--no-build", "Don't build source files")
	.option("--no-check", "Don't check source files before running")
	.option("--strict-schemas", "Strictly validate schemas", { default: true })
	.option("--no-watch", "Automatically restart server on changes")
	.option("--force-deploy-migrations", "Auto deploy migrations without using development prompt", { default: false })
	.action(
		async (opts) => {
			await watch({
				loadProjectOpts: opts,
				disableWatch: !opts.watch,
				async fn(project: Project, signal: AbortSignal) {
					await ensurePostgresRunning(project);

					// Build project
					if (opts.build) {
						await build(project, {
							runtime: Runtime.Deno,
							format: Format.Native,
							dbDriver: DbDriver.NodePostgres,
							strictSchemas: opts.strictSchemas,
							// This gets ran on `deno run`
							skipDenoCheck: true,
							migrate: {
								forceDeploy: opts.forceDeployMigrations,
							},
							signal,
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
					const entrypointPath = projectGenPath(project, ENTRYPOINT_PATH);
					const cmd = await new Deno.Command("deno", {
						args: [
							"run",
							...args,
							entrypointPath,
						],
						stdout: "inherit",
						stderr: "inherit",
						signal,
					})
						.output();
					if (!cmd.success) throw new InternalError("Entrypoint failed", { path: entrypointPath });
				},
			});
		},
	);
