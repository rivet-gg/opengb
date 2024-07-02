import { Command } from "../deps.ts";
import { GlobalOpts, initProject } from "../common.ts";
import { templateScript } from "../../template/script.ts";
import { templateModule } from "../../template/module.ts";
import { validateIdentifier } from "../../types/identifiers/mod.ts";
import { Casing } from "../../types/identifiers/defs.ts";
import { templateTest } from "../../template/test.ts";
import { templateActor } from "../../template/actor.ts";

export const createCommand = new Command<GlobalOpts>()
	.description("Create a new module or script");

createCommand.action(() => createCommand.showHelp());

createCommand.command("module").arguments("<module>").action(
	async (opts, module) => {
		validateIdentifier(
			module,
			Casing.Snake,
		);

		await templateModule(await initProject(opts), module);
	},
);

createCommand.command("script").arguments("<module> <script>").action(
	async (opts, module, script) => {
		validateIdentifier(
			module,
			Casing.Snake,
		);
		validateIdentifier(
			script,
			Casing.Snake,
		);

		await templateScript(await initProject(opts), module, script);
	},
);

createCommand.command("actor").arguments("<module> <actor>").action(
	async (opts, module, actor) => {
		validateIdentifier(
			module,
			Casing.Snake,
		);
		validateIdentifier(
			actor,
			Casing.Snake,
		);

		await templateActor(await initProject(opts), module, actor);
	},
);

createCommand.command("test").arguments("<module> <test>").action(
	async (opts, module, test) => {
		validateIdentifier(
			module,
			Casing.Snake,
		);
		validateIdentifier(
			test,
			Casing.Snake,
		);

		await templateTest(await initProject(opts), module, test);
	},
);
