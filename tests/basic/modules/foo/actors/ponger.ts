import { ActorBase } from "../module.gen.ts";

export class Actor extends ActorBase {
	static buildState(input: any) {
		return {};
	}

	async addPong() {
		let pongs = await this.storage.get("pongs") ?? 0;

		await this.storage.put("pongs", pongs + 1);

		return pongs + 1;
	}
}
