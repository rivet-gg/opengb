import { ScheduleDriver } from "../../driver.ts";
import { __GlobalDurableObjectT } from "./global_durable_object.ts";

export class CloudflareDurableObjectsSchedule implements ScheduleDriver {
	constructor(private readonly durableObject: __GlobalDurableObjectT) {}

	after(duration: number, fn: string, request: unknown): void {
		this.durableObject.scheduleEvent(Date.now() + duration, fn, request);
	}
	at(timestamp: number, fn: string, request: unknown): void {
		this.durableObject.scheduleEvent(timestamp, fn, request);
	}
}
