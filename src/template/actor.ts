import { UserError } from "../error/mod.ts";
import { dirname, resolve } from "../deps.ts";
import { getLocalRegistry, Project } from "../project/mod.ts";

export async function templateActor(
	project: Project,
	moduleName: string,
	actorName: string,
) {
	if (!getLocalRegistry(project)) throw new UserError("No \`local\` registry found in backend.json.");

	const mod = project.modules.get(moduleName);
	if (!mod) throw new UserError(`Module \`${moduleName}\` does not exist.`);
	if (!("local" in mod.registry.config)) {
		throw new UserError(`Module \`${moduleName}\` does not belong to a local registry.`);
	}
	if (mod.registry.isExternal) throw new UserError(`Module \`${moduleName}\` must not be in an external registry.`);

	// Create actor
	const actorPath = resolve(
		mod.path,
		"actors",
		actorName + ".ts",
	);
	try {
		await Deno.stat(actorPath);
		throw new UserError(`Actor \`${actorName}\` already exists in module \`${moduleName}\`.`);
	} catch (error) {
		if (!(error instanceof Deno.errors.NotFound)) {
			throw error;
		}
	}

	// Add actor to config
	const newConfig = structuredClone(mod.config);
	if (!newConfig.actors) newConfig.actors = {};
	newConfig.actors[actorName] = {};
	const newConfigRaw = JSON.stringify(newConfig, null, "\t");
	await Deno.writeTextFile(
		resolve(mod.path, "module.json"),
		newConfigRaw,
	);

	// Write default config
	const actorTs = `import { ActorBase } from "../module.gen.ts";

interface Input {

}

interface State {
  pongs: number;
}

interface MyRpcRequest {

}

interface MyRpcResponse {

}

export class Actor extends ActorBase<Input, State> {
	public initialize(_input: Input) {
    throw new Error("Unimplemented: ${moduleName}.${actorName}.initialize");
	}

  async myRpc(count: MyRpcRequest): Promise<MyRpcResponse> {
    throw new Error("Unimplemented: ${moduleName}.${actorName}.myRpc");
  }
}


`;
	await Deno.mkdir(dirname(actorPath));
	await Deno.writeTextFile(actorPath, actorTs);
}
