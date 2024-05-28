import { addFormats, Ajv } from "./deps.ts";
import { ScriptContext } from "./context.ts";
import { Context, TestContext } from "./context.ts";
import { Postgres, PrismaClientDummy } from "./postgres.ts";
import { handleRequest } from "./server.ts";
import { TraceEntryType } from "./trace.ts";
import { newTrace } from "./trace.ts";
import { RegistryCallMap } from "./proxy.ts";
import { ActorDriver } from "./actor.ts";

export interface Config {
	modules: Record<string, Module>;
}

export interface Module {
	scripts: Record<string, Script>;
	actors: Record<string, Actor>;
	errors: Record<string, ErrorConfig>;
	db?: {
		name: string;
		createPrisma: (databaseUrl: string) => CreatePrismaOutput;
	};
	dependencies: Set<string>;
	userConfig: unknown;
}

interface CreatePrismaOutput {
	prisma: PrismaClientDummy;
	pgPool?: any;
}

export interface Script {
	// deno-lint-ignore no-explicit-any
	run: ScriptRun<any, any, any, any>;
	// deno-lint-ignore no-explicit-any
	requestSchema: any;
	// deno-lint-ignore no-explicit-any
	responseSchema: any;
	public: boolean;
}

export type ScriptRun<Req, Res, UserConfigT, DatabaseT> = (
	ctx: ScriptContext<any, any, any, any, UserConfigT, DatabaseT>,
	req: Req,
) => Promise<Res>;

export interface Actor {
	actor: any;
	storageId: string;
}

export interface ErrorConfig {
	description?: string;
}

export class Runtime<DependenciesSnakeT, DependenciesCamelT, ActorsSnakeT, ActorsCamelT> {
	public postgres: Postgres;

	public ajv: Ajv.default;

	public constructor(
		public config: Config,
		public actorDriver: ActorDriver,
		private dependencyCaseConversionMap: RegistryCallMap,
		private actorDependencyCaseConversionMap: RegistryCallMap,
	) {
		this.postgres = new Postgres();

		this.ajv = new Ajv.default({
			removeAdditional: true,
		});
		// TODO: Why are types incompatible
		addFormats.default(this.ajv as any);
	}

	private async shutdown() {
		await this.postgres.shutdown();
	}

	public createRootContext(
		traceEntryType: TraceEntryType
	): Context<DependenciesSnakeT, DependenciesCamelT, ActorsSnakeT, ActorsCamelT> {
		return new Context(this, newTrace(traceEntryType), this.dependencyCaseConversionMap, this.actorDependencyCaseConversionMap);
	}

	/**
	 * Serves the runtime as an HTTP server.
	 */
	public async serve() {
		const port = parseInt(Deno.env.get("PORT") ?? "8080");
		console.log(`Serving on port ${port}`);
		await Deno.serve(
			{ port },
			(req, info) => handleRequest(this, req, { remoteAddress: info.remoteAddr.hostname }),
		).finished;
	}

	/**
	 * Registers a module test with the Deno runtime.
	 */
	public static test<DependenciesSnakeT, DependenciesCamelT, ActorsSnakeT, ActorsCamelT, UserConfigT>(
		config: Config,
		actorDriver: ActorDriver,
		moduleName: string,
		testName: string,
		fn: (
			ctx: TestContext<DependenciesSnakeT, DependenciesCamelT, ActorsSnakeT, ActorsCamelT, UserConfigT, any>,
		) => Promise<void>,
		dependencyCaseConversionMap: RegistryCallMap,
		actorDependencyCaseConversionMap: RegistryCallMap,
	) {
		Deno.test({
			name: testName,

			// TODO: https://github.com/rivet-gg/opengb-engine/issues/35
			sanitizeOps: false,
			sanitizeResources: false,

			async fn() {
				const runtime = new Runtime<DependenciesSnakeT, DependenciesCamelT, ActorsSnakeT, ActorsCamelT>(
					config,
					actorDriver,
					dependencyCaseConversionMap,
					actorDependencyCaseConversionMap,
				);

				// Build context
				const module = config.modules[moduleName];
				const ctx = new TestContext<
					DependenciesSnakeT,
					DependenciesCamelT,
					ActorsSnakeT,
					ActorsCamelT,
					UserConfigT,
					PrismaClientDummy | undefined
				>(
					runtime,
					newTrace({
						test: { module: moduleName, name: testName },
					}),
					moduleName,
					runtime.postgres.getOrCreatePool(module)?.prisma,
					dependencyCaseConversionMap,
					actorDependencyCaseConversionMap,
				);

				// Run test
				try {
					await ctx.runBlock(async () => {
						await fn(ctx);
					});
				} catch (cause) {
					console.error(
						`Failed to execute test: ${moduleName}.${testName}`,
						cause,
					);
					throw cause;
				} finally {
					await runtime.shutdown();
				}
			},
		});
	}
}
