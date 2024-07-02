import { Runtime } from "./runtime.ts";
import { Trace } from "./trace.ts";
import { RuntimeError } from "./error.ts";
import { appendTraceEntry } from "./trace.ts";
import { buildActorRegistryProxy, buildDependencyRegistryProxy, RegistryCallMap } from "./proxy.ts";
import { DependencyScriptCallFunction } from "../types/registry.ts";
import { camelify } from "../types/case_conversions.ts";

export interface ContextParams {
	dependenciesSnake: any;
	dependenciesCamel: any;
}

export class Context<Params extends ContextParams> {
	public constructor(
		protected readonly runtime: Runtime<Params>,
		public readonly trace: Trace,
		private readonly dependencyCaseConversionMap: RegistryCallMap,
		protected readonly actorCaseConversionMap: RegistryCallMap,
	) {}

	protected isAllowedModuleName(_moduleName: string): boolean {
		return true;
	}

	public call: DependencyScriptCallFunction<this, Params["dependenciesSnake"]> = async function (
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

	protected isAllowedModuleName(targetModuleName: string): boolean {
		return this.runtime.config
			.modules[this.moduleName]
			?.dependencies
			.has(targetModuleName);
	}

	public get config(): Params["userConfig"] {
		return this.runtime.config.modules[this.moduleName].userConfig as Params["userConfig"];
	}

	public get actors() {
		return buildActorRegistryProxy<Params["actorsSnake"], Params["actorsCamel"]>(
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
 * Context for a test.
 */
export class TestContext<Params extends ModuleContextParams> extends ModuleContext<Params> {}
