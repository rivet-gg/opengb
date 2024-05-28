export interface ActorDriver {
	getId(moduleName: string, actorName: string, label: string): Promise<string>;
	getActor(moduleName: string, actorName: string, label: string): Promise<any>;
	createActor(moduleName: string, actorName: string, label: string, input: any): Promise<void>;
	callActor(stub: any, fn: string, ...args: any[]): Promise<any>;
	actorExists(moduleName: string, actorName: string, label: string): Promise<boolean>;
}

// Returned from ctx.actors.xxx
export class ActorProxy {
	constructor(
		private driver: ActorDriver,
		private moduleName: string,
		private actorName: string,
	) {}

	get(label: string) {
		return new ActorHandle(this.driver, this.moduleName, this.actorName, label);
	}

	async exists(label: string) {
		return await this.driver.actorExists(this.moduleName, this.actorName, label);
	}

	async create(label: string, input: any) {
		await this.driver.createActor(this.moduleName, this.actorName, label, input);

		return new ActorHandle(this.driver, this.moduleName, this.actorName, label);
	}
}

// User-friendly class for handling actors
class ActorHandle {
	stub: any;

	constructor(
		private driver: ActorDriver,
		private moduleName: string,
		private actorName: string,
		public label: string,
	) {}

	async call(fn: string, ...args: any[]) {
		if (!this.stub) {
			this.stub = await this.driver.getActor(this.moduleName, this.actorName, this.label);
		}

		return await this.driver.callActor(this.stub, fn, args);
	}

	async exists() {
		return await this.driver.actorExists(this.moduleName, this.actorName, this.label);
	}
}
