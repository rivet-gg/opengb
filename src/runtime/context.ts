import { Runtime } from "./runtime.ts";
import { Trace } from "./trace.ts";
import { RuntimeError } from "./error.ts";
import { appendTraceEntry } from "./trace.ts";
import { buildActorRegistryProxy, buildDependencyRegistryProxy, RegistryCallMap } from "./proxy.ts";
import { DependencyScriptCallFunction } from "../types/registry.ts";
import { camelify } from "../types/case_conversions.ts";

export class Context<DependenciesSnakeT, DependenciesCamelT> {
	public constructor(
		protected readonly runtime: Runtime<DependenciesSnakeT, DependenciesCamelT>,
		public readonly trace: Trace,
		private readonly dependencyCaseConversionMap: RegistryCallMap,
		protected readonly actorCaseConversionMap: RegistryCallMap,
	) {}

	protected isAllowedModuleName(_moduleName: string): boolean {
		return true;
	}

	public call: DependencyScriptCallFunction<this, DependenciesSnakeT> = async function (
		moduleName,
		scriptName,
		req,
	) {
		console.log(
			`Request ${moduleName}.${scriptName}:\n${JSON.stringify(req, null, 2)}`,
		);

		try {
			// Check if calling module is allowed to call target module
			if (!this.isAllowedModuleName(moduleName)) {
				throw new RuntimeError(
					"CANNOT_ACCESS_MODULE",
					{ cause: `Module \`${moduleName}\` is not a dependency` },
				);
			}

			// Lookup module
			const module = this.runtime.config.modules[moduleName];
			if (!module) throw new Error(`Module not found: ${moduleName}`);

			// Lookup script
			const script = module.scripts[scriptName];
			if (!script) throw new Error(`Script not found: ${scriptName}`);

			// Build context
			const ctx = new ScriptContext(
				this.runtime,
				appendTraceEntry(this.trace, {
					script: { module: moduleName, script: scriptName },
				}),
				moduleName,
				this.runtime.postgres.getOrCreatePrismaClient(this.runtime.config, module),
				module.db?.schema,
				scriptName,
				this.dependencyCaseConversionMap,
				this.actorCaseConversionMap,
			);

			// TODO: Replace with OGBE-15
			// // Compile schemas
			// const validateRequest = this.runtime.ajv.compile(script.requestSchema);
			// const validateResponse = this.runtime.ajv.compile(script.responseSchema);

			// // Validate request
			// if (!validateRequest(req)) {
			// 	throw new Error(
			// 		`Invalid request: ${JSON.stringify(validateRequest.errors)}`,
			// 	);
			// }

			// Execute script
			const res = await ctx.runBlock(async () => await script.run(ctx, req));
			console.log(
				`Response ${moduleName}.${scriptName}:\n${JSON.stringify(res, null, 2)}`,
			);

			// TODO: Replace with OGBE-15
			// // Validate response
			// if (!validateResponse(res)) {
			// 	throw new Error(
			// 		`Invalid response: ${JSON.stringify(validateResponse.errors)}`,
			// 	);
			// }

			return res as any;
		} catch (cause) {
			console.warn(
				`Failed to execute script: ${moduleName}.${scriptName}`,
				cause,
			);
			throw cause;
		}
	};

	public get modules() {
		return buildDependencyRegistryProxy<DependenciesSnakeT, DependenciesCamelT>(
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
		const module = this.runtime.config.modules[moduleName];
		if (!module) return null;

		// Lookup script
		const script = module.scripts[scriptName];
		if (!script) return null;

		return await this.call(moduleName as any, scriptName as any, req as any);
	}

	public canCall(
		moduleName: string,
		scriptName: string,
		_req?: unknown,
	): boolean {
		// Lookup module
		const module = this.runtime.config.modules[moduleName];
		if (!module) return false;

		// Lookup script
		const script = module.scripts[scriptName];
		if (!script) return false;

		// TODO: Replace with OGBE-15
		// const validateRequest = this.runtime.ajv.compile(script.requestSchema);
		// if (req && !validateRequest(req)) return false;

		return true;
	}

	/**
	 * Runs a block of code and catches any related errors.
	 */
	public async runBlock<Res>(fn: () => Promise<Res>) {
		try {
			return await fn();
		} catch (cause) {
			// Convert error to RuntimeError. Enrich with context.
			if (cause instanceof RuntimeError) {
				cause.enrich(this.runtime, this);
				throw cause;
			} else {
				console.error("Caught internal error:", cause);
				const error = new RuntimeError("INTERNAL_ERROR", { cause });
				error.enrich(this.runtime, this);
				throw error;
			}
		}
	}
}

/**
 * Context for a module.
 */
export class ModuleContext<
	DependenciesSnakeT,
	DependenciesCamelT,
	ActorsSnakeT,
	ActorsCamelT,
	UserConfigT,
	DatabaseT,
	DatabaseSchemaT,
> extends Context<DependenciesSnakeT, DependenciesCamelT> {
	public constructor(
		runtime: Runtime<DependenciesSnakeT, DependenciesCamelT>,
		trace: Trace,
		public readonly moduleName: string,
		public readonly db: DatabaseT,
		public readonly dbSchema: DatabaseSchemaT,
		dependencyCaseConversionMap: RegistryCallMap,
		actorCaseConversionMap: RegistryCallMap,
	) {
		super(runtime, trace, dependencyCaseConversionMap, actorCaseConversionMap);
	}

	protected isAllowedModuleName(targetModuleName: string): boolean {
		return this.runtime.config
			.modules[this.moduleName]
			?.dependencies
			.has(targetModuleName);
	}

	public get config(): UserConfigT {
		return this.runtime.config.modules[this.moduleName].userConfig as UserConfigT;
	}

	public get actors() {
		return buildActorRegistryProxy<ActorsSnakeT, ActorsCamelT>(
			this.runtime,
			// TODO: Find a better way of looking up the module name. We don't use
			// camel -> snake conversions anymore for modules in actors.
			this.actorCaseConversionMap[camelify(this.moduleName)],
		);
	}
}

/**
 * Context for a script.
 */
export class ScriptContext<
	DependenciesSnakeT,
	DependenciesCamelT,
	ActorsSnakeT,
	ActorsCamelT,
	UserConfigT,
	DatabaseT,
	DatabaseSchemaT,
> extends ModuleContext<
	DependenciesSnakeT,
	DependenciesCamelT,
	ActorsSnakeT,
	ActorsCamelT,
	UserConfigT,
	DatabaseT,
	DatabaseSchemaT
> {
	public constructor(
		runtime: Runtime<DependenciesSnakeT, DependenciesCamelT>,
		trace: Trace,
		moduleName: string,
		db: DatabaseT,
		dbSchema: DatabaseSchemaT,
		public readonly scriptName: string,
		dependencyCaseConversionMap: RegistryCallMap,
		actorCaseConversionMap: RegistryCallMap,
	) {
		super(runtime, trace, moduleName, db, dbSchema, dependencyCaseConversionMap, actorCaseConversionMap);
	}
}

/**
 * Context for a test.
 */
export class TestContext<
	DependenciesSnakeT,
	DependenciesCamelT,
	ActorsSnakeT,
	ActorsCamelT,
	UserConfigT,
	DatabaseT,
	DatabaseSchemaT,
> extends ModuleContext<
	DependenciesSnakeT,
	DependenciesCamelT,
	ActorsSnakeT,
	ActorsCamelT,
	UserConfigT,
	DatabaseT,
	DatabaseSchemaT
> {}
