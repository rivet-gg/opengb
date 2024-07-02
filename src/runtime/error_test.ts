import { unimplemented } from "https://deno.land/std@0.208.0/assert/unimplemented.ts";
import { assertEquals, assertExists } from "../deps.ts";
import { ModuleContext } from "./context.ts";
import { RuntimeError } from "./error.ts";
import { BuildRuntime, newTrace } from "./mod.ts";
import { Runtime } from "./runtime.ts";
import { ActorDriver, CallOpts, CreateOpts, ExistsOpts, GetOrCreateAndCallOpts } from "./actor/driver.ts";

type DependenciesSnake = { test_module: Record<string, never> };
type DependenciesCamel = { testModule: Record<string, never> };
interface ActorsSnake {}
interface ActorsCamel {}

class DummyActorDriver implements ActorDriver {
	createActor(_opts: CreateOpts): Promise<void> {
		throw new Error("Method not implemented.");
	}
	callActor(_opts: CallOpts): Promise<unknown> {
		throw new Error("Method not implemented.");
	}
	getOrCreateAndCallActor(_opts: GetOrCreateAndCallOpts): Promise<unknown> {
		throw new Error("Method not implemented.");
	}
	actorExists(_opts: ExistsOpts): Promise<boolean> {
		throw new Error("Method not implemented.");
	}
}

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
					storageAlias: "test_module",
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
		new DummyActorDriver(),
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
