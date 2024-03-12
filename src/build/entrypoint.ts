import { resolve } from "../deps.ts";
import { Project } from "../project/mod.ts";
import { genRegistryMapPath, genRuntimeModPath, genRuntimePath } from "../project/project.ts";
import { CommandError } from "../error/mod.ts";
import { autoGenHeader } from "./misc.ts";
import { BuildOpts, DbDriver, Runtime } from "./mod.ts";

export async function generateEntrypoint(project: Project, opts: BuildOpts) {
	const runtimeModPath = genRuntimeModPath(project);
	const registryMapPath = genRegistryMapPath(project);

	// Generate module configs
	const [modImports, modConfig] = generateModImports(project, opts);

	let imports = "";

	if (opts.dbDriver == DbDriver.NodePostgres) {
		imports += `
		// Import Prisma adapter for Postgres
		import pg from "npm:pg@^8.11.3";
		import { PrismaPg } from "npm:@prisma/adapter-pg@^5.9.1";
		`;
	} else if (opts.dbDriver == DbDriver.NeonServerless) {
		imports += `
		// Import Prisma serverless adapter for Neon
		import * as neon from "https://esm.sh/@neondatabase/serverless@^0.9.0";
		import { PrismaNeonHTTP } from "https://esm.sh/@prisma/adapter-neon@^5.10.2";
		`;
	}

	let compat = "";

	if (opts.runtime == Runtime.Deno) {
		compat += `
			// Create module for Prisma compatibility
			import { createRequire } from "node:module";
			const require = createRequire(import.meta.url);
			`;
	}

	// Generate config.ts
	const configSource = `
		${autoGenHeader()}
		import { Config } from "${runtimeModPath}";

		${compat}
		${imports}
		${modImports}

		export default {
			modules: ${modConfig},
		} as Config;
		`;

	// Generate entrypoint.ts
	let entrypointSource = "";

	if (opts.runtime == Runtime.Deno) {
		entrypointSource = `
			${autoGenHeader()}
			import { Runtime } from "${runtimeModPath}";
			import { camelToSnake } from "${registryMapPath};
			import { Registry, RegistryCamel } from "./registry.d.ts";
			import config from "./runtime_config.ts";

			async function main() {
				const runtime = new Runtime<Registry, RegistryCamel>(config, camelToSnake);
				await runtime.serve();
			}

			main();
			`;
	} else if (opts.runtime == Runtime.Cloudflare) {
		const runtimePath = genRuntimePath(project);
		const serverTsPath = resolve(runtimePath, "src", "runtime", "server.ts");

		entrypointSource = `
			${autoGenHeader()}
			import { Runtime } from "${runtimeModPath}";
			import { camelToSnake } from "${registryMapPath}";
			import { Registry, RegistryCamel } from "./registry.d.ts";
			import config from "./runtime_config.ts";
			import { serverHandler } from "${serverTsPath}";

			const RUNTIME = new Runtime<Registry, RegistryCamel>(config, camelToSnake);
			const SERVER_HANDLER = serverHandler(RUNTIME);

			export default {
				async fetch(req, env) {
					// Deno env polyfill
					globalThis.Deno = {
						env: {
							get(name) {
								return env.hasOwnProperty(name) ? env[name] : undefined;
							}
						}
					};

					return await SERVER_HANDLER(req, {
						remoteAddr: {
							transport: "", // TODO:
							hostname: req.headers.get("CF-Connecting-IP"),
							port: 0, // TODO:
						}
					});
				}
			}
			`;
	}

	// Write files
	const distDir = resolve(project.path, "_gen");
	const configPath = resolve(distDir, "runtime_config.ts");
	const entrypointPath = resolve(distDir, "entrypoint.ts");
	await Deno.mkdir(distDir, { recursive: true });
	await Deno.writeTextFile(configPath, configSource);
	await Deno.writeTextFile(entrypointPath, entrypointSource);
	await Deno.writeTextFile(
		resolve(distDir, ".gitignore"),
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
			const prismaImportPath = `${mod.path}/_gen/prisma/esm.js`;
			modImports += `import ${prismaImportName} from "${prismaImportPath}";\n`;

			modConfig += `db: {`;
			modConfig += `name: ${JSON.stringify(mod.db.name)},`;
			modConfig += `createPrisma: ${generateDbDriver(opts, prismaImportName)}`;
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

function generateDbDriver(opts: BuildOpts, prismaImportName: string) {
	let dbDriver = "";

	if (opts.dbDriver == DbDriver.NodePostgres) {
		dbDriver += `(url: string) => {
			const pgPool = new pg.Pool({ connectionString: url });
			const adapter = new PrismaPg(pgPool);
			const prisma = new ${prismaImportName}.PrismaClient({
				adapter,
				log: ['query', 'info', 'warn', 'error'],
			});
			return { prisma, pgPool };
		},`;
		dbDriver += `},`;
	} else if (opts.dbDriver == DbDriver.NeonServerless) {
		dbDriver += `(url: string) => {
			const client = neon.neon(url);
			const adapter = new PrismaNeonHTTP(client);
			const prisma = new ${prismaImportName}.PrismaClient({
				adapter,
				log: ['query', 'info', 'warn', 'error'],
			});
			return { prisma, pgPool: undefined };
		},`;
		dbDriver += `},`;
	}

	return dbDriver;
}
