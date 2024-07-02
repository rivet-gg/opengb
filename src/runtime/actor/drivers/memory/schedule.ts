import { ScheduleDriver } from "../../driver.ts";
import { ACTOR_DRIVER, ActorEntry } from "./driver.ts";

export class Schedule implements ScheduleDriver {
	public constructor(private readonly actorEntry: ActorEntry) {}
	after(duration: number, fn: string, request: unknown): void {
		setTimeout(() => {
			ACTOR_DRIVER.callActor({
				moduleName: this.actorEntry.moduleName,
				actorName: this.actorEntry.actorName,
				instanceName: this.actorEntry.instanceName,
				fn,
				request,
			});
		}, duration);
	}
	at(timestamp: number, fn: string, request: unknown): void {
		setTimeout(() => {
			ACTOR_DRIVER.callActor({
				moduleName: this.actorEntry.moduleName,
				actorName: this.actorEntry.actorName,
				instanceName: this.actorEntry.instanceName,
				fn,
				request,
			});
		}, timestamp - Date.now());
	}
}
