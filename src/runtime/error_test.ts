import { unimplemented } from "https://deno.land/std@0.208.0/assert/unimplemented.ts";
import { assertEquals, assertExists } from "../deps.ts";
import { ActorDriver } from "./actor.ts";
import { ModuleContext } from "./context.ts";
import { RuntimeError } from "./error.ts";
import { BuildRuntime, newTrace } from "./mod.ts";
import { Runtime } from "./runtime.ts";

type DependenciesSnake = { test_module: Record<string, never> };
type DependenciesCamel = { testModule: Record<string, never> };
interface ActorsSnake {}
interface ActorsCamel {}

export const DUMMY_ACTOR_DRIVER: ActorDriver = {
	getId(_moduleName: string, _actorName: string, _label: string): Promise<string> {
		unimplemented();
	},
	getActor(_moduleName: string, _actorName: string, _label: string): Promise<any> {
		unimplemented();
	},
	createActor(_moduleName: string, _actorName: string, _label: string, _input: any): Promise<void> {
		unimplemented();
	},
	callActor(_stub: any, _fn: string, ..._args: any[]): Promise<any> {
		unimplemented();
	},
	actorExists(_moduleName: string, _actorName: string, _label: string): Promise<boolean> {
		unimplemented();
	},
};

Deno.test("error", async () => {
	const dependencyCaseConversionMap = {
		testModule: {},
	} as const;
	const actorCaseConversionMap = {} as const;

	// Setup
	const runtime = new Runtime<DependenciesSnake, DependenciesCamel, ActorsSnake, ActorsCamel>(
		{
			runtime: BuildRuntime.Deno,
			modules: {
				test_module: {
					scripts: {},
					routes: {},
					actors: {},
					errors: {
						"TEST_ERROR": {},
					},
					dependencies: new Set(["test_module"]),
					userConfig: null,
				},
			},
			db: {
				createPgPool: () => unimplemented(),
			},
		},
		DUMMY_ACTOR_DRIVER,
		dependencyCaseConversionMap,
		actorCaseConversionMap,
	);

	const moduleContext = new ModuleContext<
		DependenciesSnake,
		DependenciesCamel,
		ActorsSnake,
		ActorsCamel,
		null,
		undefined,
		undefined
	>(
		runtime,
		newTrace({ internalTest: {} }),
		"test_module",
		undefined,
		undefined,
		dependencyCaseConversionMap,
		actorCaseConversionMap,
	);

	// Create error
	const error = new RuntimeError("TEST_ERROR");
	assertEquals(error.message.split("\n")[0], "TEST_ERROR");

	// Erich error
	error.enrich(runtime, moduleContext);
	assertExists(error.moduleName);
	assertExists(error.trace);
	assertExists(error.errorConfig);
	assertEquals(error.message.split("\n")[0], "test_module[TEST_ERROR]");
});
