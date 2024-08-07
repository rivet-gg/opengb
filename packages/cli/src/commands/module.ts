import { Command } from "../deps.ts";
import { GlobalOpts, initProject } from "../common.ts";
import { resolve } from "../../../toolchain/src/deps.ts";
import { fetchAndResolveModule } from "../../../toolchain/src/project/mod.ts";
import { ProjectModuleConfig } from "../../../toolchain/src/config/project.ts";
import { UserError } from "../../../toolchain/src/error/mod.ts";

export const moduleCommand = new Command<GlobalOpts>()
	.description("Manage modules");

moduleCommand.action(() => moduleCommand.showHelp());

moduleCommand
	.command("add")
	.arguments("<name>")
	.option("--registry <name>", "The name of the registry to fetch the module from")
	.action(
		async (opts, moduleName) => {
			const project = await initProject(opts);

			// Ensure not already installed
			if (moduleName in project.config.modules) {
				throw new UserError(`Module \`${moduleName}\` is already installed`);
			}

			// Attempt to fetch module
			const moduleConfig: ProjectModuleConfig = {};
			if (opts.registry) moduleConfig.registry = opts.registry;
			await fetchAndResolveModule(project.path, project.configPath, project.registries, moduleName, moduleConfig);

			// Add to backend.json
			const newConfig = structuredClone(project.config);
			newConfig.modules[moduleName] = moduleConfig;
			await Deno.writeTextFile(
				resolve(project.path, "backend.json"),
				JSON.stringify(newConfig, null, "\t"),
			);
		},
	);
