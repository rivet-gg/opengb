import { Runtime } from "./runtime.ts";
import { Trace } from "./trace.ts";
import { RuntimeError, ValidationError } from "./error.ts";
import { appendTraceEntry } from "./trace.ts";
import { ActorProxies, buildActorRegistryProxy, buildDependencyRegistryProxy, RegistryCallMap } from "./proxy.ts";
import { DependencyScriptCallFunction } from "./types/registry.ts";
import { camelify } from "../../case_conversion/src/mod.ts";
import { buildLogEntries, LogEntry, logRaw, spreadObjectToLogEntries } from "./logger.ts";
import { LogLevel } from "./logger.ts";
import { INTERNAL_ERROR_CODE, stringifyTrace } from "./mod.ts";
import { Environment } from "./environment.ts";

export interface ContextParams {
	dependenciesSnake: any;
	dependenciesCamel: any;
	actorsSnake: any;
	actorsCamel: any;
}

/**
 * Provides access to information about the runtime from a context.
 */
export class ContextRuntime<Params extends ContextParams> {
	constructor(private readonly runtime: Runtime<Params>) {}

	public get publicEndpoint(): string {
		return this.runtime.publicEndpoint;
	}
}

export class Context<Params extends ContextParams> {
	public readonly log: ContextLog<Params>;

	public get runtime(): ContextRuntime<Params> {
		return new ContextRuntime(this.internalRuntime);
	}

	public get environment(): Environment {
		return this.internalRuntime.env;
	}

	public constructor(
		protected readonly internalRuntime: Runtime<Params>,
		public readonly trace: Trace,
		private readonly dependencyCaseConversionMap: RegistryCallMap,
		protected readonly actorCaseConversionMap: RegistryCallMap,
	) {
		this.log = new ContextLog(this);
	}

	protected getRouteContext(moduleName: string, routeName: string) {
		const module = this.internalRuntime.config.modules[moduleName];
		if (!module) throw new Error(`Module not found: ${moduleName}`);

		const route = module.routes[routeName];
		if (!route) throw new Error(`Route not found: ${routeName}`);

		return new RouteContext(
			this.internalRuntime,
			appendTraceEntry(this.trace, {
				route: { module: moduleName, route: routeName },
			}),
			moduleName,
			this.internalRuntime.postgres.getOrCreatePrismaClient(
				this.internalRuntime.env,
				this.internalRuntime.config,
				module,
			),
			module.db?.schema,
			routeName,
			this.dependencyCaseConversionMap,
			this.actorCaseConversionMap,
		);
	}

	protected isAllowedModuleName(_moduleName: string): boolean {
		return true;
	}

	public call: DependencyScriptCallFunction<this, Params["dependenciesSnake"]> = async function (
		moduleName,
		scriptName,
		req,
	) {
		// Check if calling module is allowed to call target module
		if (!this.isAllowedModuleName(moduleName)) {
			throw new RuntimeError(
				"CANNOT_ACCESS_MODULE",
				{ cause: `Module \`${moduleName}\` is not a dependency` },
			);
		}

		// Lookup module
		const module = this.internalRuntime.config.modules[moduleName]!;
		if (!module) throw new Error(`Module not found: ${moduleName}`);

		// Lookup script
		const script = module.scripts[scriptName];
		if (!script) throw new Error(`Script not found: ${scriptName}`);

		// Build context
		const ctx = new ScriptContext(
			this.internalRuntime,
			appendTraceEntry(this.trace, {
				script: { module: moduleName, script: scriptName },
			}),
			moduleName,
			this.internalRuntime.postgres.getOrCreatePrismaClient(
				this.internalRuntime.env,
				this.internalRuntime.config,
				module,
			),
			module.db?.schema,
			scriptName,
			this.dependencyCaseConversionMap,
			this.actorCaseConversionMap,
		);
		ctx.log._listeners.push(...this.log._listeners);

		const requestParseResult = await script.requestSchema.safeParseAsync(req);
		if (!requestParseResult.success) {
			throw new ValidationError("Request did not match schema.", requestParseResult.error);
		}

		const request = requestParseResult.data;

		// Log start
		const scriptStart = performance.now();
		ctx.log.debug("script request", ...spreadObjectToLogEntries("request", request));

		// Execute script
		const duration = Math.ceil(performance.now() - scriptStart);
		const res = await ctx.runBlock(async () => await script.run(ctx, request));

		// Log finish
		//
		// `duration` will be 0 on Cloudflare Workers if there are no async
		// actions performed inside of the request:
		// https://developers.cloudflare.com/workers/runtime-apis/performance/
		ctx.log.debug(
			"script response",
			...(duration > 0 ? [["duration", `${duration}ms`] as LogEntry] : []),
			...spreadObjectToLogEntries("response", res),
		);

		const responseParseResult = await script.responseSchema.safeParseAsync<typeof res>(res);
		if (!responseParseResult.success) {
			throw new ValidationError(
				"Response did not match schema. If you are the module author, check the response type.",
				responseParseResult.error,
			);
		}
		return responseParseResult.data;
	};

	public get modules() {
		return buildDependencyRegistryProxy<Params>(
			this,
			this.dependencyCaseConversionMap,
		);
	}

	public async tryCallRaw(
		moduleName: string,
		scriptName: string,
		req: unknown,
	): Promise<object | null> {
		// Lookup module
		const module = this.internalRuntime.config.modules[moduleName];
		if (!module) return null;

		// Lookup script
		const script = module.scripts[scriptName];
		if (!script) return null;

		return await this.call(moduleName as any, scriptName as any, req as any);
	}

	public async canCall(
		moduleName: string,
		scriptName: string,
		req?: unknown,
	): Promise<boolean> {
		// Lookup module
		const module = this.internalRuntime.config.modules[moduleName];
		if (!module) return false;

		// Lookup script
		const script = module.scripts[scriptName];
		if (!script) return false;

		const result = await script.requestSchema.safeParseAsync(req);
		if (!result.success) return false;

		return true;
	}

	/**
	 * Runs a block of code and catches any related errors. Errors thrown from
	 * this block will be enriched or replaced with an INTERNAL_ERROR.
	 */
	public async runBlock<Res>(fn: () => Promise<Res>): Promise<Res> {
		try {
			return await fn();
		} catch (cause) {
			if (cause === undefined) {
				this.log.warn("caught undefined error from task. this may be caused using by cross-request promises.");
			}

			if (cause instanceof RuntimeError) {
				// Enrich error with more context
				cause.enrich(this.internalRuntime, this);
				throw cause;
			} else {
				// Convert to RuntimeError
				const error = new RuntimeError(INTERNAL_ERROR_CODE, { cause });
				error.enrich(this.internalRuntime, this);
				throw error;
			}
		}
	}

	public runBlockSync<Res>(fn: () => Res): Res {
		try {
			return fn();
		} catch (cause) {
			if (cause instanceof RuntimeError) {
				// Enrich error with more context
				cause.enrich(this.internalRuntime, this);
				throw cause;
			} else {
				// Convert to RuntimeError
				const error = new RuntimeError(INTERNAL_ERROR_CODE, { cause });
				error.enrich(this.internalRuntime, this);
				throw error;
			}
		}
	}
}

export type LogListener = (level: LogLevel, entries: LogEntry[]) => void;

class ContextLog<Params extends ContextParams> {
	public _listeners: LogListener[] = [];

	constructor(private readonly context: Context<Params>) {}

	public addListener(listener: LogListener) {
		this._listeners.push(listener);
	}

	private log(level: LogLevel, message: string, ...data: LogEntry[]) {
		// Build entries
		const logEntries = buildLogEntries(
			level,
			message,
			["trace", stringifyTrace(this.context.trace)],
			...data,
		);

		// Capture logs
		for (const listener of this._listeners) {
			listener(level, logEntries);
		}

		// Output
		logRaw(level, ...logEntries);
	}

	public error(message: string, ...data: LogEntry[]) {
		this.log("error", message, ...data);
	}

	public warn(message: string, ...data: LogEntry[]) {
		this.log("warn", message, ...data);
	}

	public info(message: string, ...data: LogEntry[]) {
		this.log("info", message, ...data);
	}

	public debug(message: string, ...data: LogEntry[]) {
		this.log("debug", message, ...data);
	}

	public trace(message: string, ...data: LogEntry[]) {
		this.log("trace", message, ...data);
	}
}

export interface ModuleContextParams extends ContextParams {
	actorsSnake: any;
	actorsCamel: any;
	userConfig: any;
	database: any;
	databaseSchema: any;
}

/**
 * Context for a module.
 */
export class ModuleContext<Params extends ModuleContextParams> extends Context<Params> {
	public constructor(
		runtime: Runtime<Params>,
		trace: Trace,
		public readonly moduleName: string,
		public readonly db: Params["database"],
		public readonly dbSchema: Params["databaseSchema"],
		dependencyCaseConversionMap: RegistryCallMap,
		actorCaseConversionMap: RegistryCallMap,
	) {
		super(runtime, trace, dependencyCaseConversionMap, actorCaseConversionMap);
	}

	protected override isAllowedModuleName(targetModuleName: string): boolean {
		return this.internalRuntime.config
			.modules[this.moduleName]
			?.dependencies
			.has(targetModuleName) ?? false;
	}

	public get config(): Params["userConfig"] {
		return this.internalRuntime.config.modules[this.moduleName]!.userConfig as Params["userConfig"];
	}

	public get actors(): ActorProxies<Params["actorsCamel"]> {
		return buildActorRegistryProxy<Params["actorsSnake"], Params["actorsCamel"]>(
			this.internalRuntime,
			// TODO: Find a better way of looking up the module name. We don't use
			// camel -> snake conversions anymore for modules in actors.
			this.actorCaseConversionMap[camelify(this.moduleName)]!,
			this.trace,
		);
	}
}

/**
 * Context for a script.
 */
export class ScriptContext<Params extends ModuleContextParams> extends ModuleContext<Params> {
	public constructor(
		runtime: Runtime<Params>,
		trace: Trace,
		moduleName: string,
		db: Params["database"],
		dbSchema: Params["databaseSchema"],
		public readonly scriptName: string,
		dependencyCaseConversionMap: RegistryCallMap,
		actorCaseConversionMap: RegistryCallMap,
	) {
		super(runtime, trace, moduleName, db, dbSchema, dependencyCaseConversionMap, actorCaseConversionMap);
	}
}

/**
 * Context for an actor.
 */
export class ActorContext<Params extends ModuleContextParams> extends ModuleContext<Params> {
	public constructor(
		runtime: Runtime<Params>,
		trace: Trace,
		moduleName: string,
		db: Params["database"],
		dbSchema: Params["databaseSchema"],
		public readonly actorName: string,
		dependencyCaseConversionMap: RegistryCallMap,
		actorCaseConversionMap: RegistryCallMap,
	) {
		super(runtime, trace, moduleName, db, dbSchema, dependencyCaseConversionMap, actorCaseConversionMap);
	}
}

/**
 * Context for a route.
 */
export class RouteContext<Params extends ModuleContextParams> extends ModuleContext<Params> {
	public constructor(
		runtime: Runtime<Params>,
		trace: Trace,
		moduleName: string,
		db: Params["database"],
		dbSchema: Params["databaseSchema"],
		public readonly routeName: string,
		dependencyCaseConversionMap: RegistryCallMap,
		actorCaseConversionMap: RegistryCallMap,
	) {
		super(runtime, trace, moduleName, db, dbSchema, dependencyCaseConversionMap, actorCaseConversionMap);
	}

	public static fromContext<Params extends ModuleContextParams>(
		ctx: Context<Params>,
		moduleName: string,
		routeName: string,
	): RouteContext<Params> {
		// FIXME: This is a pretty terrible hack. We should find a better way to
		// do this, probably with a "public" underscore function.
		const ctxWithPublicGRC = ctx as unknown as { getRouteContext: Context<Params>["getRouteContext"] };
		return ctxWithPublicGRC.getRouteContext(moduleName, routeName);
	}
}

/**
 * Context for a test.
 */
export class TestContext<Params extends ModuleContextParams> extends ModuleContext<Params> {}
