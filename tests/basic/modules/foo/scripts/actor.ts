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

  let pongs = await ctx.actors.ponger.getOrCreateAndCall<{}, number, number>(id, {}, "addPong", 5);

	return { pongs };
}
