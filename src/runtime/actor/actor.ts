import { ScheduleDriver, StorageDriver } from "./driver.ts";

/**
 * Actor implementation that user-made actors will extend.
 */
export abstract class ActorBase<Input, State> {
	public constructor(
		public readonly storage: StorageDriver,
		public readonly schedule: ScheduleDriver,
		public state: State,
	) {}

	public abstract initialize(input: Input): State | Promise<State>;
}
