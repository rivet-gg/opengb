import { BuildState, buildStep, waitForBuildPromises } from "../../build_state/mod.ts";
import { denoPlugins, esbuild, exists, resolve } from "../../deps.ts";
import { Project } from "../../project/mod.ts";
import { BuildOpts, Format, Runtime } from "../mod.ts";
import { generateClient } from "../../migrate/generate.ts";
import { inflateRuntimeArchive } from "../inflate_runtime_archive.ts";
import { planModuleBuild } from "./module.ts";
import { compileTypeHelpers } from "../gen/mod.ts";
import { generateDenoConfig } from "../deno_config.ts";
import { generateEntrypoint } from "../entrypoint.ts";
import { generateOpenApi } from "../openapi.ts";
import { InternalError } from "../../error/mod.ts";
import { UserError } from "../../error/mod.ts";
import { glob } from "../../project/deps.ts";
import { migrateDeploy } from "../../migrate/deploy.ts";
import { migrateDev } from "../../migrate/dev.ts";
import { generateMeta } from "../meta.ts";
import { BUNDLE_PATH, genPath, genPrismaOutputBundle, genPrismaOutputFolder } from "../../project/project.ts";
import { ENTRYPOINT_PATH } from "../../project/project.ts";
import { MANIFEST_PATH } from "../../project/project.ts";
import { compileActorTypeHelpers } from "../gen/mod.ts";

export async function planProjectBuild(
	buildState: BuildState,
	project: Project,
	opts: BuildOpts,
) {
	const signal = buildState.signal;

	// Generate Prisma clients
	for (const module of project.modules.values()) {
		if (module.db) {
			buildStep(buildState, {
				id: `module.${module.name}.generate.prisma`,
				name: "Generate",
				description: `prisma_output/`,
				module,
				condition: {
					files: [resolve(module.path, "db", "schema.prisma")],
					expressions: {
						runtime: opts.runtime,
					},
				},
				async build({ signal }) {
					// Generate client
					await generateClient(project, [module], opts.runtime, signal);
				},
			});
		}
	}

	// TODO: Add way to compare runtime artifacts (or let this be handled by the cache version and never rerun?)
	buildStep(buildState, {
		id: `project.generate.runtime`,
		name: "Generate",
		description: "runtime/",
		async build({ signal }) {
			await inflateRuntimeArchive(project, signal);
		},
	});

	// Wait for runtime since script schemas depend on this
	await waitForBuildPromises(buildState);

	for (const module of project.modules.values()) {
		await planModuleBuild(buildState, project, module, opts);
	}

	buildStep(buildState, {
		id: `project.generate.dependencies`,
		name: "Generate",
		description: "dependencies.d.ts",
		condition: {
			files: [...project.modules.values()].map((m) => resolve(m.path, "module.yaml")),
		},
		async build() {
			await compileTypeHelpers(project);
		},
	});

	buildStep(buildState, {
		id: `project.generate.actors`,
		name: "Generate",
		description: "actors.d.ts",
		condition: {
			files: [...project.modules.values()].map((m) => resolve(m.path, "module.yaml")),
		},
		async build() {
			await compileActorTypeHelpers(project);
		},
	});

	buildStep(buildState, {
		id: `project.generate.deno_config`,
		name: "Generate",
		description: "deno.json",
		async build() {
			await generateDenoConfig(project);
		},
	});

	// Wait for module schemas requestSchema/responseSchema
	await waitForBuildPromises(buildState);

	buildStep(buildState, {
		id: `project.generate.entrypoint`,
		name: "Generate",
		description: "entrypoint.ts",
		async build() {
			await generateEntrypoint(project, opts);
		},
	});

	buildStep(buildState, {
		id: `project.generate.openapi`,
		name: "Generate",
		description: "openapi.json",
		async build() {
			await generateOpenApi(project);
		},
	});

	buildStep(buildState, {
		id: `project.generate.meta`,
		name: "Generate",
		description: "meta.json",
		async build() {
			await generateMeta(project);
		},
	});

	if (opts.format == Format.Bundled) {
		buildStep(buildState, {
			id: `project.bundle`,
			name: "Bundle",
			description: "bundle.js",
			async build({ signal }) {
				const bundledFile = genPath(project, BUNDLE_PATH);

				await esbuild.build({
					entryPoints: [genPath(project, ENTRYPOINT_PATH)],
					outfile: bundledFile,
					format: "esm",
					platform: "neutral",
					plugins: [...denoPlugins()],
					external: [
						// Don't include deno's crypto, its a standard js API
						"*crypto/crypto.ts",
						// Exclude node APIs, most are included in CF workers with
						// https://developers.cloudflare.com/workers/runtime-apis/nodejs/
						"node:*",
						// Wasm must be loaded as a separate file manually, cannot be bundled
						"*.wasm",
						"*.wasm?module",
						// This import only exists when running on cloudflare
						"cloudflare:workers",
					],
					bundle: true,
					minify: true,
				});

				signal.throwIfAborted();

				// For some reason causes the program to exit early instead of waiting
				// await esbuild.stop();

				if (opts.runtime == Runtime.Cloudflare) {
					let bundleStr = await Deno.readTextFile(bundledFile);

					// Remove unused import to deno crypto
					bundleStr = bundleStr.replace(
						/import\{crypto as \w+\}from"https:\/\/deno\.land\/std@[\d\.]+\/crypto\/crypto\.ts";/,
						"",
					);

					// Remove unused import (`node:timers` isn't available in cf workers)
					// https://developers.cloudflare.com/workers/runtime-apis/nodejs/
					bundleStr = bundleStr.replaceAll(`import"node:timers";`, "");

					// Find any `query-engine.wasm`
					let wasmPath;
					for (const module of project.modules.values()) {
						const moduleWasmPath = resolve(
							genPrismaOutputFolder(project, module),
							"query_engine_bg.wasm",
						);

						if (await exists(moduleWasmPath)) {
							wasmPath = moduleWasmPath;
							break;
						}
					}

					// Check if wasm is actually required
					if (wasmPath) {
						// Make wasm import relative
						bundleStr = bundleStr.replaceAll(
							/file:[\w\\/\.\-]+query_engine_bg\.wasm/g,
							"query-engine.wasm",
						);
					} else if (/file:[\w\\/\.\-]+query_engine_bg\.wasm/.test(bundleStr)) {
						throw new InternalError("Failed to find required query_engine_bg.wasm", { path: bundledFile });
					}

					signal.throwIfAborted();

					await Deno.writeTextFile(bundledFile, bundleStr);

					// Write manifest of file paths for easier upload from Rivet CLI
					const manifest = {
						bundle: bundledFile,
						wasm: wasmPath,
					};

					signal.throwIfAborted();

					await Deno.writeTextFile(
						genPath(project, MANIFEST_PATH),
						JSON.stringify(manifest),
					);
				}
			},
		});
	}

	// TODO: SDKs

	await waitForBuildPromises(buildState);

	// TODO: This is disabled when building for cf because there is an unresolved import
	if (opts.runtime != Runtime.Cloudflare) {
		buildStep(buildState, {
			id: `project.check.entrypoint`,
			name: "Check",
			description: ".opengb/entrypoint.ts",
			async build() {
				const checkOutput = await new Deno.Command("deno", {
					args: ["check", "--quiet", resolve(project.path, ".opengb", "entrypoint.ts")],
					signal,
				}).output();
				if (!checkOutput.success) {
					throw new UserError("Check failed.", {
						details: new TextDecoder().decode(checkOutput.stderr).trim(),
					});
				}
			},
		});
	}

	await waitForBuildPromises(buildState);

	if (opts.migrate) {
		// Deploy external migrations in parallel
		for (const module of project.modules.values()) {
			if (module.db && (opts.migrate.forceDeploy || module.registry.isExternal)) {
				const migrations = await glob.glob(resolve(module.path, "db", "migrations", "*", "*.sql"));
				buildStep(buildState, {
					id: `module.${module.name}.migrate.deploy`,
					name: "Migrate Database",
					module,
					description: "deploy",
					condition: {
						files: migrations,
					},
					async build({ signal }) {
						await migrateDeploy(project, [module], signal);
					},
				});
			}
		}

		await waitForBuildPromises(buildState);

		// Deploy dev migrations one at a time
		for (const module of project.modules.values()) {
			if (module.db && !opts.migrate.forceDeploy && !module.registry.isExternal) {
				const migrations = await glob.glob(resolve(module.path, "db", "migrations", "*", "*.sql"));
				buildStep(buildState, {
					id: `module.${module.name}.migrate.dev`,
					name: "Migrate Database",
					module,
					description: "develop",
					condition: {
						files: [resolve(module.path, "db", "schema.prisma"), ...migrations],
					},
					async build({ signal }) {
						await migrateDev(project, [module], {
							createOnly: false,
							// HACK: Disable lock since running this command in watch does not clear the lock correctly
							disableSchemaLock: true,
							signal,
						});
					},
				});

				await waitForBuildPromises(buildState);
			}
		}
	}
}
