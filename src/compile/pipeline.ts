import { join } from "../deps.ts";
import { type Project } from "../project/mod.ts";
import { createTask, type Task } from "./task.ts";
import { crypto, encodeHex, mergeReadableStreams } from "./deps.ts";

type PipelineFactory = (tools: { task: typeof createTask }) => Task;

const findTasks = (task: Task): Task[] => {
  const deps = task.deps ?? [];
  return [
    task,
    ...deps.reduce((prev, task) => {
      return [...prev, ...findTasks(task)];
    }, [] as Task[]),
  ];
};

interface PipelineConfig {
  project: Project;
}

export class Pipeline {
  private mainTask: Task;

  constructor(private config: PipelineConfig, factory: PipelineFactory) {
    this.mainTask = factory({ task: createTask });
  }

  async run() {
    const allTasks = new Set(findTasks(this.mainTask));

    const executedTasks = new Set<Task>();

    console.group("Pipeline");

    // sort topologically tasks and run them
    while (executedTasks.size < allTasks.size) {
      for (const task of allTasks) {
        if (executedTasks.has(task)) {
          continue;
        }

        const deps = task.deps ?? [];

        if (deps.every((dep) => executedTasks.has(dep))) {
          await this.runTask(task);
          executedTasks.add(task);
        }
      }
    }
    console.groupEnd();
  }

  async watch() {
    const allTasks = new Set(findTasks(this.mainTask));

    const paths = [];
    for (const task of allTasks) {
      paths.push(...task.input);
    }

    const watcher = Deno.watchFs(paths, { recursive: true });
    console.log("Started watching for file changes...");
    for await (const event of watcher) {
      console.log("File change", event);
      // it's safe to run the whole pipeline as individual tasks are cached
      await this.run();
    }
  }

  static prepare(project: Project) {
    return Deno.mkdirSync(
      join(project.path, ".ogs", "compile", "cache"),
      {
        recursive: true,
      },
    );
  }

  private async cache(task: Task) {
    const streams = await Promise.all(task.input.map(async (inputFilepath) => {
      return (await Deno.open(inputFilepath, { read: true })).readable;
    }));
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      mergeReadableStreams(...streams),
    );
    const fileHash = encodeHex(hashBuffer);
    const cacheFilename = join(
      this.config.project.path,
      ".ogs",
      "compile",
      "cache",
      `${task.name}-${fileHash}`,
    );

    let isCached = false;
    try {
      await Deno.stat(cacheFilename);
      isCached = true;
    } catch {
      isCached = false;
    }

    const clear = async () => {
      for await (const entry of Deno.readDir(join(cacheFilename, "../"))) {
        if (entry.name.startsWith(task.name)) {
          try {
            await Deno.remove(join(cacheFilename, entry.name), {
              recursive: true,
            });
          } catch {
            // ignore
          }
        }
      }
    };

    const write = async () => {
      await clear();
      await Deno.writeTextFile(cacheFilename, "");
    };

    return { isCached, write, clear };
  }

  private async runTask(task: Task) {
    const { isCached, write, clear } = await this.cache(task);

    if (isCached) {
      return;
    }

    try {
      await task.run();
      await write();
    } catch {
      await clear();
    }
  }
}

export const pipeline = (config: PipelineConfig, factory: PipelineFactory) => {
  return new Pipeline(config, factory);
};

pipeline.prepare = Pipeline.prepare;
