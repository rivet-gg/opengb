import { addFormats, Ajv } from "./deps.ts";
import { ScriptContext } from "./context.ts";
import { Context, RouteContext, TestContext } from "./context.ts";
import { PgPoolDummy, Postgres, PrismaClientDummy } from "./postgres.ts";
import { serverHandler } from "./server.ts";
import { TraceEntryType } from "./trace.ts";
import { newTrace } from "./trace.ts";
import { RegistryCallMap } from "./proxy.ts";
import { ActorDriver } from "./actor.ts";
import { QualifiedPathPair } from "./path_resolver.ts";

export interface Config {
	runtime: BuildRuntime;
	modules: Record<string, Module>;
	cors?: CorsConfig;
	db: {
		createPgPool: (url: URL) => PgPoolDummy;
	};
}

/**
 * Which runtime to target when building.
 */
export enum BuildRuntime {
	Deno,
	Cloudflare,
}

export interface Module {
	scripts: Record<string, Script>;
	actors: Record<string, Actor>;
	routes: Record<string, Route>;
	errors: Record<string, ErrorConfig>;
	db?: {
		/** Name of the Postgres schema the tables live in. */
		schema: string;
		createPrismaClient: (pool: PgPoolDummy, schema: string) => PrismaClientDummy;
	};
	dependencies: Set<string>;
	userConfig: unknown;
}

export interface CorsConfig {
	origins: Set<string>;
}

export interface Script {
	// deno-lint-ignore no-explicit-any
	run: ScriptRun<any, any, any, any, any>;
	// deno-lint-ignore no-explicit-any
	requestSchema: any;
	// deno-lint-ignore no-explicit-any
	responseSchema: any;
	public: boolean;
}

export interface RouteBase {
	// deno-lint-ignore no-explicit-any
	run: RouteRun<any, any, any>;
	methods: Set<string>;
}

export interface PrefixRoute extends RouteBase {
	pathPrefix: string;
}

export interface ExactRoute extends RouteBase {
	path: string;
}

export type Route = ExactRoute | PrefixRoute;

export type ScriptRun<Req, Res, UserConfigT, DatabaseT, DatabaseSchemaT> = (
	ctx: ScriptContext<any, any, any, any, UserConfigT, DatabaseT, DatabaseSchemaT>,
	req: Req,
) => Promise<Res>;

export interface Actor {
	actor: any;
	storageId: string;
}

export type RouteRun<UserConfigT, DatabaseT, DatabaseSchemaT> = (
	ctx: RouteContext<any, any, any, any, UserConfigT, DatabaseT, DatabaseSchemaT>,
	req: Request,
) => Promise<Response>;

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
		private actorCaseConversionMap: RegistryCallMap,
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
		traceEntryType: TraceEntryType,
	): Context<DependenciesSnakeT, DependenciesCamelT, ActorsSnakeT, ActorsCamelT> {
		return new Context(
			this,
			newTrace(traceEntryType, this.config.runtime),
			this.dependencyCaseConversionMap,
			this.actorCaseConversionMap,
		);
	}

	public createRootRouteContext(
		traceEntryType: TraceEntryType,
		moduleName: string,
		routeName: string,
	): RouteContext<
		DependenciesSnakeT,
		DependenciesCamelT,
		ActorsSnakeT,
		ActorsCamelT,
		unknown,
		PrismaClientDummy | undefined,
		any
	> {
		const module = this.config.modules[moduleName];
		if (!module) throw new Error(`Module not found: ${moduleName}`);

		return new RouteContext(
			this,
			newTrace(traceEntryType),
			moduleName,
			this.postgres.getOrCreatePrismaClient(this.config, module),
			module.db?.schema,
			routeName,
			this.dependencyCaseConversionMap,
			this.actorCaseConversionMap,
		);
	}

	/**
	 * Serves the runtime as an HTTP server.
	 */
	public async serve() {
		const port = parseInt(Deno.env.get("PORT") ?? "6420");
		console.log(`Serving on port ${port}`);

		await Deno.serve({ port }, serverHandler(this)).finished;
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
			ctx: TestContext<DependenciesSnakeT, DependenciesCamelT, ActorsSnakeT, ActorsCamelT, UserConfigT, any, any>,
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
					PrismaClientDummy | undefined,
					string | undefined
				>(
					runtime,
					newTrace({
						test: { module: moduleName, name: testName },
					}),
					moduleName,
					runtime.postgres.getOrCreatePrismaClient(runtime.config, module),
					module.db?.schema,
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

	/**
	 * Only runs on a CORS preflight request— returns a response with the
	 * appropriate CORS headers & status.
	 *
	 * @param req The preflight OPTIONS request
	 * @returns The full response to the preflight request
	 */
	public corsPreflight(req: Request): Response {
		const origin = req.headers.get("Origin");
		if (origin) {
			const normalizedOrigin = new URL(origin).origin;
			if (this.config.cors) {
				if (this.config.cors.origins.has(normalizedOrigin)) {
					return new Response(undefined, {
						status: 204,
						headers: {
							...this.corsHeaders(req),
							"Vary": "Origin",
						},
					});
				}
			}
		}

		// Origin is not allowed/no origin header on preflight
		return new Response(
			JSON.stringify({
				"message": "CORS origin not allowed. See https://opengb.dev/docs/cors",
			}),
			{
				status: 403,
				headers: {
					"Vary": "Origin",
				},
			},
		);
	}

	public corsHeaders(req: Request): Record<string, string> {
		const origin = req.headers.get("Origin");

		// Don't set CORS headers if there's no origin (e.g. a server-side
		// request)
		if (!origin) return {};

		// If the origin is allowed, return the appropriate headers.
		// Otherwise, return a non-matching cors header (empty object).
		if (this.config.cors?.origins.has(origin)) {
			return {
				"Access-Control-Allow-Origin": new URL(origin).origin,
				"Access-Control-Allow-Methods": "*",
				"Access-Control-Allow-Headers": "*",
			};
		} else {
			return {};
		}
	}

	public corsAllowed(req: Request): boolean {
		const origin = req.headers.get("Origin");

		if (!origin) return true;
		return this.config.cors?.origins.has(origin) ?? false;
	}

	public routePaths(): QualifiedPathPair[] {
		const paths: QualifiedPathPair[] = [];
		for (const moduleName in this.config.modules) {
			const module = this.config.modules[moduleName];
			for (const routeName in module.routes) {
				const route = module.routes[routeName];
				if ("path" in route) {
					paths.push({
						module: moduleName,
						route: routeName,
						path: { path: route.path, isPrefix: false },
					});
				} else {
					paths.push({
						module: moduleName,
						route: routeName,
						path: { path: route.pathPrefix, isPrefix: true },
					});
				}
			}
		}
		return paths;
	}
}

export type PathPair = { path: string; isPrefix: boolean };
