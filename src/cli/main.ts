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
import { printError } from "../error/mod.ts";
import { runShutdown } from "../utils/shutdown_handler.ts";

// Run command
const command = new Command();
command.action(() => command.showHelp())
	.globalOption("-p, --path <path>", "Path to project root")
	.throwErrors()
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
	.command("completions", new CompletionsCommand());

// Run command
let exitCode = 0;
try {
	await command.parse();
} catch (err) {
	if (err instanceof ValidationError && err.cmd) {
		// Print Cliffy help
		err.cmd.showHelp();
		exitCode = err.exitCode;
	} else {
		// Print error
		printError(err);
		exitCode = 1;
	}
} finally {
	await runShutdown();
}

Deno.exit(exitCode);
