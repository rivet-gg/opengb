import { resolve } from "../deps.ts";
import { ACTOR_PATH, genActorCaseConversionMapPath, genRuntimeActorDriverPath, Project } from "../project/mod.ts";
import {
	ENTRYPOINT_PATH,
	genDependencyCaseConversionMapPath,
	genPath,
	genPrismaOutputBundle,
	genRuntimeModPath,
	GITIGNORE_PATH,
	RUNTIME_CONFIG_PATH,
	RUNTIME_PATH,
} from "../project/project.ts";
import { CommandError, UnreachableError } from "../error/mod.ts";
import { autoGenHeader } from "./misc.ts";
import { BuildOpts, DbDriver, Runtime, runtimeToString } from "./mod.ts";
import { dedent } from "./deps.ts";

export async function generateEntrypoint(project: Project, opts: BuildOpts) {
	const runtimeModPath = genRuntimeModPath(project);

	// Generate module configs
	const [modImports, modConfig] = generateModImports(project, opts);

	let imports = "";

	if (opts.dbDriver == DbDriver.NodePostgres) {
		imports += `
		// Import Prisma adapter for Postgres
    //
    // We can't use esm.sh for these because they rely on special Node
    // functionality & don't need to be portable
    //
    // https://github.com/esm-dev/esm.sh/issues/684
		import pg from "npm:pg@^8.11.3";
		import { PrismaPg } from "npm:@prisma/adapter-pg@^5.12.0";
		`;
	} else if (opts.dbDriver == DbDriver.NeonServerless) {
		imports += `
		// Import Prisma serverless adapter for Neon
		import * as neon from "https://esm.sh/@neondatabase/serverless@^0.9.3";
		import { PrismaNeon } from "https://esm.sh/@prisma/adapter-neon@^5.15.0";
		`;
	} else if (opts.dbDriver == DbDriver.CloudflareHyperdrive) {
		imports += `
		// Import Prisma adapter for Postgres
    //
    // We can't use esm.sh for these because they rely on special Node
    // functionality & don't need to be portable
    //
    // https://github.com/esm-dev/esm.sh/issues/684
    // import 'npm:pg-cloudflare';
		import pg from "npm:pg@8.12.0";
		import { PrismaPg } from "npm:@prisma/adapter-pg@5.12.0";
		`;
	}

	// CORS
	let corsSource = "";
	if (project.config.runtime?.cors) {
		corsSource = `
			cors: {
				origins: new Set(${JSON.stringify(project.config.runtime.cors.origins)}),
			},
		`;
	}

	// Generate config.ts
	const configSource = `
		${autoGenHeader()}
		import { Config, BuildRuntime } from "${runtimeModPath}";

		${imports}
		${modImports}

		export default {
			runtime: BuildRuntime.${runtimeToString(opts.runtime)},
			modules: ${modConfig},
			${corsSource}
      db: {
        createPgPool: ${generateCreatePgPool(opts)},
      },
		} as Config;
		`;

	// Generate entrypoint.ts
	let entrypointSource = "";

	const actorDriverPath: string = genRuntimeActorDriverPath(project, opts.runtime);
	if (opts.runtime == Runtime.Deno) {
		entrypointSource = `
			${autoGenHeader()}
			import { Runtime } from "${runtimeModPath}";
			import { dependencyCaseConversionMap } from "${genDependencyCaseConversionMapPath(project)}";
			import { actorCaseConversionMap } from "${genActorCaseConversionMapPath(project)}";
			import type { DependenciesSnake, DependenciesCamel } from "./dependencies.d.ts";
			import type { ActorsSnake, ActorsCamel } from "./actors.d.ts";
			import config from "./runtime_config.ts";
			import { ActorDriver } from ${JSON.stringify(actorDriverPath)};

			const runtime = new Runtime<{
        dependenciesSnake: DependenciesSnake,
        dependenciesCamel: DependenciesCamel,
      }>(
				config,
				new ActorDriver(config),
				dependencyCaseConversionMap,
				actorCaseConversionMap,
			);

			await runtime.serve();
			`;
	} else if (opts.runtime == Runtime.CloudflareWorkersPlatforms) {
		const runtimePath = genPath(project, RUNTIME_PATH);
		const serverTsPath = resolve(runtimePath, "src", "runtime", "server.ts");
		const errorTsPath = resolve(runtimePath, "src", "runtime", "error.ts");

		entrypointSource = `
			${autoGenHeader()}
			import type { IncomingRequestCf } from 'https://raw.githubusercontent.com/skymethod/denoflare/v0.6.0/common/cloudflare_workers_types.d.ts';
			import { Runtime } from "${runtimeModPath}";
			import { RuntimeError } from "${errorTsPath}";
			import { dependencyCaseConversionMap } from "${genDependencyCaseConversionMapPath(project)}";
			import { actorCaseConversionMap } from "${genActorCaseConversionMapPath(project)}";
			import type { DependenciesSnake, DependenciesCamel } from "./dependencies.d.ts";
			import type { ActorsSnake, ActorsCamel } from "./actors.d.ts";
			import config from "./runtime_config.ts";
			import { handleRequest } from "${serverTsPath}";
			import { ActorDriver, buildGlobalDurableObjectClass } from ${JSON.stringify(actorDriverPath)};

			export default {
				async fetch(req: IncomingRequestCf, env: Record<string, unknown>) {
          ${hyperdriveAdapter(opts)}

          ${denoEnvPolyfill()}

          // TODO(OGBE-159): Move this back to global scope after dbs are correctly isolated
          const runtime = new Runtime<{
            dependenciesSnake: DependenciesSnake,
            dependenciesCamel: DependenciesCamel,
          }>(
            config,
            new ActorDriver(config),
            dependencyCaseConversionMap,
            actorCaseConversionMap,
          );

					const ip = req.headers.get("CF-Connecting-IP");
					if (!ip) {
						throw new RuntimeError(
							"CANNOT_READ_IP",
							{ cause: "Could not get IP of incoming request" },
						);
					}

					return await handleRequest(runtime, req, {
						remoteAddress: ip,
					});
				}
			}

			// Export durable object binding
			export {
        __GlobalDurableObject: buildGlobalDurableObjectClass(config)
      };
			`;
	}

	// Write files
	const distDir = resolve(project.path, "_gen");
	const configPath = genPath(project, RUNTIME_CONFIG_PATH);
	const entrypointPath = genPath(project, ENTRYPOINT_PATH);
	const actorPath = genPath(project, ACTOR_PATH);

	await Deno.mkdir(distDir, { recursive: true });
	await Deno.writeTextFile(configPath, configSource);
	await Deno.writeTextFile(entrypointPath, entrypointSource);
	await Deno.writeTextFile(
		genPath(project, GITIGNORE_PATH),
		".",
	);

	// Format files
	const fmtOutput = await new Deno.Command("deno", {
		args: ["fmt", configPath, entrypointPath],
		signal: opts.signal,
	}).output();
	if (!fmtOutput.success) throw new CommandError("Failed to format generated files.", { commandOutput: fmtOutput });
}

function generateModImports(project: Project, opts: BuildOpts) {
	let modImports = "";
	let modConfig = "{";
	for (const mod of project.modules.values()) {
		modConfig += `${JSON.stringify(mod.name)}: {`;

		modConfig += `"storageAlias": ${JSON.stringify(mod.storageAlias)},`;

		// Generate script configs
		modConfig += "scripts: {";
		for (const script of mod.scripts.values()) {
			const runIdent = `modules$$${mod.name}$$${script.name}$$run`;

			modImports += `import { run as ${runIdent} } from '${mod.path}/scripts/${script.name}.ts';\n`;

			modConfig += `${JSON.stringify(script.name)}: {`;
			modConfig += `run: ${runIdent},`;
			modConfig += `public: ${JSON.stringify(script.config.public ?? false)},`;
			modConfig += `requestSchema: ${JSON.stringify(script.requestSchema)},`;
			modConfig += `responseSchema: ${JSON.stringify(script.responseSchema)},`;
			modConfig += `},`;
		}
		modConfig += "},";

		// Generate actor configs
		modConfig += "actors: {";
		for (const actor of mod.actors.values()) {
			const actorIdent = `modules$$${mod.name}$$${actor.name}$$Actor`;

			modImports += `import { Actor as ${actorIdent} } from '${mod.path}/actors/${actor.name}.ts';\n`;

			modConfig += `${JSON.stringify(actor.name)}: {`;
			modConfig += `actor: ${actorIdent},`;
			modConfig += `storageAlias: ${JSON.stringify(actor.storageAlias)},`;
			modConfig += `},`;
		}
		modConfig += "},";

		// Generate error configs
		modConfig += `errors: ${JSON.stringify(mod.config.errors)},`;

		// Generate dependency lookup
		modConfig += `dependencies: new Set([`;
		modConfig += JSON.stringify(mod.name) + ",";
		for (const dependencyName in mod.config.dependencies) {
			modConfig += JSON.stringify(dependencyName) + ",";
		}
		modConfig += `]),`;

		// Generate db config
		if (mod.db) {
			const prismaImportName = `prisma$$${mod.name}`;
			const prismaImportPath = genPrismaOutputBundle(project, mod);
			modImports += `import ${prismaImportName} from ${JSON.stringify(prismaImportPath)};\n`;

			modConfig += `db: {`;
			modConfig += `schema: ${JSON.stringify(mod.db.schema)},`;
			modConfig += `createPrismaClient: ${generateCreatePrismaClient(opts, prismaImportName)},`;
			modConfig += `},`;
		} else {
			modConfig += `db: undefined,`;
		}

		// Generate user config
		modConfig += `userConfig: ${JSON.stringify(mod.userConfig)},`;

		modConfig += "},";
	}
	modConfig += "}";

	return [modImports, modConfig];
}

function generateCreatePgPool(opts: BuildOpts) {
	if (opts.dbDriver == DbDriver.NodePostgres) {
		return dedent`
      (url: URL) => {
        return new pg.Pool({
          connectionString: url.toString(),
        });
      }
    `;
	} else if (opts.dbDriver == DbDriver.NeonServerless) {
		return dedent`
      (url: URL) => {
        return new neon.Pool({
          connectionString: url.toString(),
        });
      }
    `;
	} else if (opts.dbDriver == DbDriver.CloudflareHyperdrive) {
		return dedent`
      (url: URL) => {
        return new pg.Pool({
          connectionString: url.toString(),
          // Limit connection pool size since Hyperdrive already maintains a pool
          //
          // https://github.com/prisma/prisma/issues/23367#issuecomment-1981340554
          max: 2,
        });
      }
    `;
	} else {
		throw new UnreachableError(opts.dbDriver);
	}
}

function generateCreatePrismaClient(opts: BuildOpts, prismaImportName: string) {
	if (opts.dbDriver == DbDriver.NodePostgres || opts.dbDriver == DbDriver.CloudflareHyperdrive) {
		return dedent`
      (pgPool: pg.Pool, schema: string) => {
        const adapter = new PrismaPg(pgPool, { schema });
        const prisma = new ${prismaImportName}.PrismaClient({
          adapter,
          log: ['query', 'info', 'warn', 'error'],
        });
        return prisma;
      }
    `;
	} else if (opts.dbDriver == DbDriver.NeonServerless) {
		return dedent`
      (pgPool: neon.Pool, schema: string) => {
        const adapter = new PrismaNeon(pgPool, { schema });
        const prisma = new ${prismaImportName}.PrismaClient({
          adapter,
          log: ['query', 'info', 'warn', 'error'],
        });
        return prisma;
      }
    `;
	} else {
		throw new UnreachableError(opts.dbDriver);
	}
}

function hyperdriveAdapter(opts: BuildOpts): string {
	if (opts.dbDriver != DbDriver.CloudflareHyperdrive) return "";
	return dedent`
    interface Hyperdrive {
      connectionString: string;
    }

    env.DATABASE_URL = (env.__HYPERDRIVE as Hyperdrive).connectionString;
  `;
}

function denoEnvPolyfill() {
	// Deno env polyfill
	return dedent`
		globalThis.Deno = {
			env: {
				get(name: string): unknown | undefined {
					return env.hasOwnProperty(name) ? env[name] : undefined;
				},
				set() {
					throw new RuntimeError("UNIMPLEMENTED", {
						cause: "Deno.env.set is unimplemented in Cloudflare Workers"
					});
				},
				delete() {
					throw new RuntimeError("UNIMPLEMENTED", {
						cause: "Deno.env.delete is unimplemented in Cloudflare Workers"
					});
				},
				has(name: string): boolean {
					return env.hasOwnProperty(name);
				},
				toObject(): { [k:string]: string; } {
					return Object.fromEntries(
						Object.entries(env as { [k: string]: string; })
							.filter(([k, v]) => typeof v === 'string')
						);
				}
			}
		} as any;
	`;
}
