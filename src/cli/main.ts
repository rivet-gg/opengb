import {
  Command,
  CompletionsCommand,
  HelpCommand,
  ValidationError,
} from "./deps.ts";
import { devCommand } from "./commands/dev.ts";
import { buildCommand } from "./commands/build.ts";
import { dbCommand } from "./commands/db.ts";
import { testCommand } from "./commands/test.ts";
import { sdkCommand } from "./commands/sdk.ts";
import { createCommand } from "./commands/create.ts";
import { compileCommand } from "./commands/compile.ts";

const command = await new Command();
command.action(() => command.showHelp())
  .globalOption("-p, --path <path>", "Path to project root")
  .command("dev", devCommand)
  .command("test", testCommand)
  .command("db", dbCommand)
  .command("build", buildCommand)
  .command("sdk", sdkCommand)
  .command("create", createCommand)
  .command("compile", compileCommand)
  .command("help", new HelpCommand().global())
  .command("completions", new CompletionsCommand())
  .error((error, cmd) => {
    if (error instanceof ValidationError) {
      cmd.showHelp();
    } else {
      console.error(error);
    }
    Deno.exit(error instanceof ValidationError ? error.exitCode : 1);
  })
  .parse(Deno.args);
