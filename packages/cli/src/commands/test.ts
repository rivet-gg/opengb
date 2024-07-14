import { resolve } from "../../../toolchain/src/deps.ts";
import { Command, glob } from "../deps.ts";
import { GlobalOpts } from "../common.ts";
import { build, DbDriver, Format, Runtime } from "../../../toolchain/src/build/mod.ts";
import { ensurePostgresRunning } from "../../../toolchain/src/utils/postgres_daemon.ts";
import { watch } from "../../../toolchain/src/watch/mod.ts";
import { Project } from "../../../toolchain/src/project/mod.ts";
import { UserError } from "../../../toolchain/src/error/mod.ts";
import { info } from "../../../toolchain/src/term/status.ts";

// TODO: https://github.com/rivet-gg/opengb-engine/issues/86
export const testCommand = new Command<GlobalOpts>()
	.description("Run tests")
	.arguments("[modules...:string]")
	.option("--no-build", "Don't build source files")
	.option("--no-check", "Don't check source files before running")
	.option("--strict-schemas", "Strictly validate schemas", { default: false })
	.option("--force-deploy-migrations", "Auto deploy migrations without using development prompt", { default: false })
	.option("-w, --watch", "Automatically rerun tests on changes")
	.action(
		async (opts, ...modulesFilter: string[]) => {
			await watch({
				loadProjectOpts: opts,
				disableWatch: !opts.watch,
				fn: async (project: Project, signal: AbortSignal) => {
					await ensurePostgresRunning(project);

					// Build project
					if (opts.build) {
						await build(project, {
							runtime: Runtime.Deno,
							format: Format.Native,
							dbDriver: DbDriver.NodePostgres,
							strictSchemas: opts.strictSchemas,
							// This gets ran on `deno test`
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

					// Find test scripts
					const testingModules = [];
					for (const module of project.modules.values()) {
						// Filter modules
						if (modulesFilter.length == 0) {
							// Only test local modules
							if (module.registry.isExternal) continue;
						} else {
							// Only test specified modules. This allows for testing remote modules.
							if (!modulesFilter.includes(module.name)) continue;
						}

						testingModules.push(module.name);

						// Test all modules or filter module tests
						const testPaths = (await glob.glob("*.ts", {
							cwd: resolve(module.path, "tests"),
						}))
							.map((path) => resolve(module.path, "tests", path));
						args.push(...testPaths);
					}

					if (testingModules.length == 0) {
						info("Finished", "No modules to test");
						return;
					}

					// Run tests
					info("Testing", testingModules.join(", "));
					const cmd = await new Deno.Command("deno", {
						args: [
							"test",
							...args,
						],
						stdout: "inherit",
						stderr: "inherit",
						signal,
						env: {
							// Force color for test logs
							"OPENGB_TERM_COLOR": Deno.env.get("OPENGB_TERM_COLOR") ?? "always",
						},
					})
						.output();
					if (!cmd.success) throw new UserError("Tests failed.");
				},
			});
		},
	);
