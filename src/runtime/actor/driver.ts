import { Trace } from "../mod.ts";

export interface CreateOpts {
	moduleName: string;
	actorName: string;
	instanceName: string;
	input: unknown;
	trace: Trace;
}

export interface CallOpts {
	moduleName: string;
	actorName: string;
	instanceName: string;
	fn: string;
	request: unknown;
	trace: Trace;
}

export interface GetOrCreateAndCallOpts {
	moduleName: string;
	actorName: string;
	instanceName: string;
	input: unknown;
	fn: string;
	request: unknown;
	trace: Trace;
}

export interface ExistsOpts {
	moduleName: string;
	actorName: string;
	instanceName: string;
}

export interface ActorDriver {
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
