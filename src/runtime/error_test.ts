import { unimplemented } from "https://deno.land/std@0.208.0/assert/unimplemented.ts";
import { assertEquals, assertExists } from "../deps.ts";
import { ModuleContext } from "./context.ts";
import { RuntimeError } from "./error.ts";
import { BuildRuntime, newTrace } from "./mod.ts";
import { Runtime } from "./runtime.ts";
import { ActorDriver } from "./actor/driver.ts";

type DependenciesSnake = { test_module: Record<string, never> };
type DependenciesCamel = { testModule: Record<string, never> };
interface ActorsSnake {}
interface ActorsCamel {}

export const DUMMY_ACTOR_DRIVER: ActorDriver = {
	config: undefined as any,
	createActor(_opts): Promise<void> {
		unimplemented();
	},
	callActor(_opts): Promise<unknown> {
		unimplemented();
	},
	getOrCreateAndCallActor(_opts): Promise<unknown> {
		unimplemented();
	},
	actorExists(_opts): Promise<boolean> {
		unimplemented();
	},
};

Deno.test("error", async () => {
	const dependencyCaseConversionMap = {
		testModule: {},
	} as const;
	const actorCaseConversionMap = {} as const;

	// Setup
	const runtime = new Runtime<DependenciesSnake, DependenciesCamel>(
		{
			runtime: BuildRuntime.Deno,
			modules: {
				test_module: {
					scripts: {},
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
