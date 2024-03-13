import { assertEquals, assertExists } from "../deps.ts";
import { ModuleContext } from "./context.ts";
import { RuntimeError } from "./error.ts";
import { newTrace } from "./mod.ts";
import { Runtime } from "./runtime.ts";

type ErrReg = { test_module: Record<string, never> };
type ErrRegCamel = { testModule: Record<string, never> };

Deno.test("error", async () => {
	const camelToSnakeLookup = {
		testModule: {},
	} as const;
	// Setup
	const runtime = new Runtime<ErrReg, ErrRegCamel>({
		modules: {
			test_module: {
				scripts: {},
				errors: {
					"TEST_ERROR": {},
				},
				dependencies: new Set(["test_module"]),
				userConfig: null,
			},
		},
	}, camelToSnakeLookup);
	const moduleContext = new ModuleContext<ErrReg, ErrRegCamel, null, undefined>(
		runtime,
		newTrace({ internalTest: {} }),
		"test_module",
		undefined,
		camelToSnakeLookup,
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
