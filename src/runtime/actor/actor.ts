import { ModuleContextParams } from "../context.ts";
import { Config } from "../mod.ts";
import { ScheduleDriver, StorageDriver } from "./driver.ts";

/**
 * Actor implementation that user-made actors will extend.
 */
export abstract class ActorBase<
	Params extends ModuleContextParams,
	Input,
	State,
> {
	public constructor(
		public readonly config: Config,
		public readonly storage: StorageDriver,
		public readonly schedule: ScheduleDriver,
		public state: State,
	) {}

	public abstract initialize(input: Input): State | Promise<State>;
}
