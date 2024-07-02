import { ActorDriver } from "./driver.ts";

// Returned from ctx.actors.xxx
export class ActorProxy {
	constructor(
		private driver: ActorDriver,
		private moduleName: string,
		private actorName: string,
	) {}

	async create<Input>(instanceName: string, input: Input): Promise<void> {
		await this.driver.createActor({
			moduleName: this.moduleName,
			actorName: this.actorName,
			instanceName,
			input,
		});
	}

	async call<Request, Response>(instanceName: string, fn: string, request: Request): Promise<Response> {
		return await this.driver.callActor({
			moduleName: this.moduleName,
			actorName: this.actorName,
			instanceName,
			fn,
			request,
		}) as Response;
	}

	async getOrCreateAndCall<Input, Request, Response>(
		instanceName: string,
		input: Input,
		fn: string,
		request: Request,
	): Promise<Response> {
		return await this.driver.getOrCreateAndCallActor({
			moduleName: this.moduleName,
			actorName: this.actorName,
			instanceName,
			input,
			fn,
			request,
		}) as Response;
	}

	async exists(instanceName: string) {
		return await this.driver.actorExists({
			moduleName: this.moduleName,
			actorName: this.actorName,
			instanceName,
		});
	}
}
