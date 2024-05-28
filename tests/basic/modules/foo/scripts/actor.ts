import { ScriptContext } from "../module.gen.ts";

export interface Request {
	id?: string;
}

export interface Response {
	pongs: number;
}

export async function run(
	ctx: ScriptContext,
	req: Request,
): Promise<Response> {
	let id = req.id ?? "me";

	let ponger;
	if (!await ctx.actors.foo.ponger.exists(id)) {
		ponger = await ctx.actors.foo.ponger.create(id, {});
	} else {
		ponger = ctx.actors.foo.ponger.get(id);
	}

	let pongs = await ponger.call("addPong");

	return { pongs };
}
