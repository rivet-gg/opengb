import { Command, CompletionsCommand, HelpCommand, ValidationError } from "./deps.ts";
import { devCommand } from "./commands/dev.ts";
import { buildCommand } from "./commands/build.ts";
import { dbCommand } from "./commands/db.ts";
import { testCommand } from "./commands/test.ts";
import { sdkCommand } from "./commands/sdk.ts";
import { createCommand } from "./commands/create.ts";
import { lintCommand } from "./commands/lint.ts";
import { formatCommand } from "./commands/format.ts";
import { initCommand } from "./commands/init.ts";
import { cleanCommand } from "./commands/clean.ts";
import { cleanupAllPools } from "../utils/worker_pool.ts";

// Run command
const command = new Command();
command.action(() => command.showHelp())
	.globalOption("-p, --path <path>", "Path to project root")
	.command("init", initCommand)
	.command("dev", devCommand)
	.command("create", createCommand)
	.command("test", testCommand)
	.command("database, db", dbCommand)
	.command("sdk", sdkCommand)
	.command("format, fmt", formatCommand)
	.command("lint", lintCommand)
	.command("build", buildCommand)
	.command("clean", cleanCommand)
	.command("help", new HelpCommand().global())
	.command("completions", new CompletionsCommand())
	.error((error, cmd) => {
		if (error instanceof ValidationError) {
			cmd.showHelp();
		} else {
			console.error(error);
		}
		Deno.exit(error instanceof ValidationError ? error.exitCode : 1);
	});
await command.parse(Deno.args);

// Cleanup
cleanupAllPools();
