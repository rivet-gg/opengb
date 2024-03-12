import { Command } from "../deps.ts";
import { GlobalOpts, initProject } from "../common.ts";
import { listSourceFiles } from "../../project/mod.ts";
import { UserError } from "../../error/mod.ts";

export const lintCommand = new Command<GlobalOpts>()
	.description("Lint source files")
	.action(
		async (opts) => {
			const project = await initProject(opts);

			const sourceFiles = await listSourceFiles(project, { localOnly: true });

			const cmd = await new Deno.Command("deno", {
				args: [
					"lint",
					...sourceFiles,
				],
				stdout: "inherit",
				stderr: "inherit",
			})
				.output();
			if (!cmd.success) throw new UserError("Lint failed.", { paths: sourceFiles });
		},
	);
