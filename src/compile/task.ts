import { glob, globSync } from "./deps.ts";

interface TaskArguments {
  input?: string | string[];
}

interface TaskConfig {
  name: string;
  args: TaskArguments;
  executor: (tools: { files: string[] }) => Promise<void> | void;
  deps?: Task[];
}

export class Task {
  constructor(
    private config: TaskConfig,
    private inputFiles = globSync(config.args.input ?? []),
  ) {}

  get name() {
    return this.config.name;
  }

  get input(): string[] {
    return this.inputFiles;
  }

  get output(): string[] {
    return this.output;
  }

  // getter for deps
  get deps() {
    return this.config.deps;
  }

  async run() {
    console.group(this.config.name);
    await this.config.executor({ files: this.inputFiles });
    console.groupEnd();
  }

  async watch() {
  }
}

export const createTask = (
  name: TaskConfig["name"],
  args: TaskConfig["args"],
  executor: TaskConfig["executor"],
  deps: TaskConfig["deps"] = [],
) => {
  return new Task({ name, args, executor, deps });
};
