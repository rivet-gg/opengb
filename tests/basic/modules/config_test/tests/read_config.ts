import { TestContext, test } from "../_gen/test.ts";
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

test("e2e", async (ctx: TestContext) => {
	const res = await ctx.call("config_test", "read_config", {}) as any;
	assertEquals(res.config.foo, "hello world");
	assertEquals(res.config.bar, 1234);
});

