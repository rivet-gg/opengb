import { Runtime } from "./runtime.ts";
import { Trace } from "./trace.ts";
import { RuntimeError } from "./error.ts";
import { appendTraceEntry } from "./trace.ts";
import { buildRegistryProxy, MapFrom } from "./proxy.ts";
import { RegistryCallFn } from "../types/registry.ts";

export class Context<RegistryT, RegistryCamelT> {
	public constructor(
		protected readonly runtime: Runtime<RegistryT, RegistryCamelT>,
		public readonly trace: Trace,
		private readonly camelMap: MapFrom<RegistryCamelT, RegistryT>,
	) {}

	protected isAllowedModuleName(_moduleName: string): boolean {
		return true;
	}

	public call: RegistryCallFn<this, RegistryT> = async function (
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
				this.runtime.postgres.getOrCreatePool(module)?.prisma,
				scriptName,
				this.camelMap,
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
		return buildRegistryProxy<RegistryT, RegistryCamelT>(
			this,
			this.camelMap,
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
export class ModuleContext<RegistryT, RegistryCamelT, UserConfigT, DatabaseT>
	extends Context<RegistryT, RegistryCamelT> {
	public constructor(
		runtime: Runtime<RegistryT, RegistryCamelT>,
		trace: Trace,
		public readonly moduleName: string,
		public readonly db: DatabaseT,
		camelMap: MapFrom<RegistryCamelT, RegistryT>,
	) {
		super(runtime, trace, camelMap);
	}

	protected isAllowedModuleName(targetModuleName: string): boolean {
		return this.runtime.config
			.modules[this.moduleName]
			?.dependencies
			.has(targetModuleName);
	}

	public get userConfig(): UserConfigT {
		return this.runtime.config.modules[this.moduleName].userConfig as UserConfigT;
	}
}

/**
 * Context for a script.
 */
export class ScriptContext<RegistryT, RegistryCamelT, UserConfigT, DatabaseT>
	extends ModuleContext<RegistryT, RegistryCamelT, UserConfigT, DatabaseT> {
	public constructor(
		runtime: Runtime<RegistryT, RegistryCamelT>,
		trace: Trace,
		moduleName: string,
		db: DatabaseT,
		public readonly scriptName: string,
		camelMap: MapFrom<RegistryCamelT, RegistryT>,
	) {
		super(runtime, trace, moduleName, db, camelMap);
	}
}

/**
 * Context for a test.
 */
export class TestContext<RegistryT, RegistryCamelT, UserConfigT, DatabaseT>
	extends ModuleContext<RegistryT, RegistryCamelT, UserConfigT, DatabaseT> {}
