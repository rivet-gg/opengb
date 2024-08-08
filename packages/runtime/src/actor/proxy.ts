import { LogEntry, spreadObjectToLogEntries } from "../logger.ts";
import { ActorContext, appendTraceEntry, Runtime, Trace } from "../mod.ts";
import { ActorDriver } from "./driver.ts";

// Returned from ctx.actors.xxx
export class ActorProxy {
	constructor(
		private runtime: Runtime<any>,
		private driver: ActorDriver,
		private moduleName: string,
		private actorName: string,
		private trace: Trace,
	) {}

	/**
	 * Build actor ctx. This is primarily for internal use, this will not be
	 * passed to a user. There will be another actor ctx built inside the actor
	 * driver itself that will be used within the actor itself.
	 */
	private createActorContext(trace: Trace): ActorContext<any> {
		const module = this.runtime.config.modules[this.moduleName]!;
		const context = new ActorContext<any>(
			this.runtime,
			trace,
			this.moduleName,
			this.runtime.postgres.getOrCreatePrismaClient(this.runtime.env, this.runtime.config, module),
			module.db?.schema,
			this.actorName,
			// These aren't used so we don't need to provide them
			{},
			{},
		);

		return context;
	}

	public async create<Input>(instanceName: string, input: Input): Promise<void> {
		const ctx = this.createActorContext(
			appendTraceEntry(this.trace, { actorInitialize: { module: this.moduleName, actor: this.actorName } }),
		);

		const start = performance.now();
		if (this.runtime.env.get("_OPENGB_LOG_ACTOR_BODY") == "1") {
			ctx.log.debug("create actor", ...spreadObjectToLogEntries("input", input));
		} else {
			ctx.log.debug("create actor");
		}

		await this.driver.createActor({
			moduleName: this.moduleName,
			actorName: this.actorName,
			instanceName,
			input,
			trace: this.trace,
		});

		const duration = Math.ceil(performance.now() - start);
		ctx.log.debug("actor created", ...(duration > 0 ? [["duration", `${duration}ms`] as LogEntry] : []));
	}

	public async call<Request, Response>(instanceName: string, fn: string, request: Request): Promise<Response> {
		const ctx = this.createActorContext(
			appendTraceEntry(this.trace, { actorCall: { module: this.moduleName, actor: this.actorName, fn } }),
		);

		const start = performance.now();
		if (this.runtime.env.get("_OPENGB_LOG_ACTOR_BODY") == "1") {
			ctx.log.debug("actor request", ["instance", instanceName], ...spreadObjectToLogEntries("request", request));
		} else {
			ctx.log.debug("actor request", ["instance", instanceName]);
		}

		const response = await this.driver.callActor({
			moduleName: this.moduleName,
			actorName: this.actorName,
			instanceName,
			fn,
			request,
			trace: this.trace,
		}) as Response;

		const duration = Math.ceil(performance.now() - start);
		if (this.runtime.env.get("_OPENGB_LOG_ACTOR_BODY") == "1") {
			ctx.log.debug(
				"actor response",
				...(duration > 0 ? [["duration", `${duration}ms`] as LogEntry] : []),
				...spreadObjectToLogEntries("response", response),
			);
		} else {
			ctx.log.debug("actor response", ...(duration > 0 ? [["duration", `${duration}ms`] as LogEntry] : []));
		}

		return response;
	}

	public async getOrCreateAndCall<Input, Request, Response>(
		instanceName: string,
		input: Input,
		fn: string,
		request: Request,
	): Promise<Response> {
		const ctx = this.createActorContext(
			appendTraceEntry(this.trace, { actorGetOrCreateAndCall: { module: this.moduleName, actor: this.actorName, fn } }),
		);

		const start = performance.now();
		if (this.runtime.env.get("_OPENGB_LOG_ACTOR_BODY") == "1") {
			ctx.log.debug(
				"actor request",
				["instance", instanceName],
				...spreadObjectToLogEntries("input", input),
				...spreadObjectToLogEntries("request", request),
			);
		} else {
			ctx.log.debug("actor request", ["instance", instanceName]);
		}

		const response = await this.driver.getOrCreateAndCallActor({
			moduleName: this.moduleName,
			actorName: this.actorName,
			instanceName,
			input,
			fn,
			request,
			trace: this.trace,
		}) as Response;

		const duration = Math.ceil(performance.now() - start);
		if (this.runtime.env.get("_OPENGB_LOG_ACTOR_BODY") == "1") {
			ctx.log.debug(
				"actor response",
				...(duration > 0 ? [["duration", `${duration}ms`] as LogEntry] : []),
				...spreadObjectToLogEntries("response", response),
			);
		} else {
			ctx.log.debug("actor response", ...(duration > 0 ? [["duration", `${duration}ms`] as LogEntry] : []));
		}

		return response;
	}

	public async exists(instanceName: string) {
		const ctx = this.createActorContext(this.trace);

		const start = performance.now();

		const response = await this.driver.actorExists({
			moduleName: this.moduleName,
			actorName: this.actorName,
			instanceName,
		});

		const duration = Math.ceil(performance.now() - start);
		if (response) {
			ctx.log.debug(
				"actor exists",
				["instance", instanceName],
				...(duration > 0 ? [["duration", `${duration}ms`] as LogEntry] : []),
			);
		} else {
			ctx.log.debug(
				"actor does not exist",
				["instance", instanceName],
				...(duration > 0 ? [["duration", `${duration}ms`] as LogEntry] : []),
			);
		}

		return response;
	}

	public async destroy(instanceName: string) {
		const ctx = this.createActorContext(this.trace);

		const start = performance.now();

		await this.driver.destroyActor({
			moduleName: this.moduleName,
			actorName: this.actorName,
			instanceName,
		});

		const duration = Math.ceil(performance.now() - start);
		ctx.log.debug(
			"actor destroyed",
			["instance", instanceName],
			...(duration > 0 ? [["duration", `${duration}ms`] as LogEntry] : []),
		);
	}
}
