import { StorageDriver } from "../../driver.ts";
import { ActorEntry } from "./driver.ts";

export class Storage implements StorageDriver {
	public constructor(private readonly actorEntry: ActorEntry) {}

	async get<V>(key: string): Promise<V | undefined> {
		const value = this.actorEntry.storage.get(key);
		if (value) return JSON.parse(value);
		else return undefined;
	}

	async put<V>(key: string, value: V): Promise<void> {
		this.actorEntry.storage.set(key, JSON.stringify(value));
	}

	async delete(key: string): Promise<void> {
		this.actorEntry.storage.delete(key);
		throw new Error("Method not implemented.");
	}
}
