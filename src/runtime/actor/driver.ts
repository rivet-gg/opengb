import { Config } from "../mod.ts";

interface CreateOpts {
	moduleName: string;
	actorName: string;
	instanceName: string;
	input: unknown;
}

interface CallOpts {
	moduleName: string;
	actorName: string;
	instanceName: string;
	fn: string;
	request: unknown;
}

interface GetOrCreateAndCallOpts {
	moduleName: string;
	actorName: string;
	instanceName: string;
	input: unknown;
	fn: string;
	request: unknown;
}

interface ExistsOpts {
	moduleName: string;
	actorName: string;
	instanceName: string;
}

export interface ActorDriver {
	// TODO: doc write set by global
	config: Config;
	createActor(opts: CreateOpts): Promise<void>;
	callActor(opts: CallOpts): Promise<unknown>;
	getOrCreateAndCallActor(opts: GetOrCreateAndCallOpts): Promise<unknown>;
	actorExists(opts: ExistsOpts): Promise<boolean>;
}

export interface StorageDriver {
	get<V>(key: string): Promise<V | undefined>;
	put<V>(key: string, value: V): Promise<void>;
	delete(key: string): Promise<void>;
}

export interface ScheduleDriver {
	after(duration: number, fn: string, request: unknown): void;
	at(timestamp: number, fn: string, request: unknown): void;
}
