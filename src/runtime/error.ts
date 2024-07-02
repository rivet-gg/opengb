import { ModuleContext } from "./context.ts";
import { Context } from "./context.ts";
import { ModuleContextParams } from "./mod.ts";
import { ErrorConfig, Runtime } from "./runtime.ts";
import { Trace } from "./trace.ts";

export interface RuntimeErrorOptions extends ErrorOptions {
	meta?: any;
}

export class RuntimeError extends Error {
	/**
	 * The module this error originated from.
	 *
	 * Will be undefined if the error is not enriched yet.
	 */
	public moduleName?: string;

	/**
	 * Call trace of the error.
	 *
	 * Will be undefined if the error is not enriched yet.
	 */
	public trace?: Trace;

	/**
	 * Config of the error.
	 *
	 * Will be undefined if the error is not enriched yet.
	 */
	public errorConfig?: ErrorConfig;

	/**
	 * Additional metadata of the error.
	 */
	public meta?: ErrorConfig;

	public constructor(
		public readonly code: string,
		options?: RuntimeErrorOptions,
	) {
		super(code, options);
		this.meta = options?.meta;
	}

	/**
	 * Called by `Context` when an error is caught.
	 */
	public enrich<
		Params extends ModuleContextParams,
		Ctx extends Context<Params>,
	>(
		runtime: Runtime<Params>,
		context: Ctx,
	) {
		// Add context to error
		if (context instanceof ModuleContext) {
			this.moduleName = context.moduleName;
		}
		this.trace = context.trace;

		// Lookup error config
		if (this.moduleName) {
			const errorConfig = runtime.config.modules[this.moduleName]
				?.errors[this.code];
			if (errorConfig) {
				this.errorConfig = errorConfig;
				if (errorConfig.description) {
					this.message = `${this.moduleName}[${this.code}]: ${errorConfig.description}\nTrace: ${
						JSON.stringify(context.trace)
					}`;
				}
			} else {
				console.warn(`Error config not found for ${this.code}`);
			}
		}

		// Build enriched message
		let message = "";
		if (this.moduleName) {
			message += `${this.moduleName}[${this.code}]`;
		} else {
			message += this.code;
		}
		if (this.errorConfig?.description) {
			message += `: ${this.errorConfig.description}`;
		}
		message += `\nTrace: ${JSON.stringify(this.trace)}`;
		this.message = message;
	}
}
