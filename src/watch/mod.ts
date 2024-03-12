import { abortable } from "./deps.ts";
import { resolve, SEP } from "../deps.ts";
import { Project } from "../project/mod.ts";
import { loadProject } from "../project/project.ts";
import { info, verbose } from "../term/status.ts";
import { InternalError } from "../error/mod.ts";
import { printError } from "../error/mod.ts";
import { colors } from "../term/deps.ts";

export interface WatchOpts {
	/**
	 * If true, don't watch for changes and just runs `fn` once.
	 *
	 * This is useful for keeping logic simple where watching needs to be
	 * disabled.
	 */
	disableWatch?: boolean;

	fn: (project: Project, signal: AbortSignal) => Promise<void>;
}

export async function watch(initProject: Project, opts: WatchOpts) {
	// TODO: debounce
	// TODO: catch errors

	if (opts.disableWatch) {
		await opts.fn(initProject, new AbortController().signal);
		return;
	}

	let project = initProject;
	let loadProjectSuccess = true;
	while (true) {
		const sttyOutput = await new Deno.Command("stty", {
			args: ["sane"],
			stdin: "inherit",
			stdout: "inherit",
			stderr: "inherit",
		}).output();
		if (!sttyOutput.success) {
			console.warn("Failed to run `stty sane`. This may cause terminal issues.");
		}

		const { columns } = Deno.consoleSize();
		console.log(`\n${colors.dim("─".repeat(columns))}\n`);

		// Run action
		let fnAbortController: AbortController | undefined;
		if (loadProjectSuccess) {
			fnAbortController = new AbortController();
			abortable(
				wrapWatchFn(project, opts, fnAbortController.signal),
				fnAbortController.signal,
			)
				.catch((err) => {
					if (err.name != "AbortError") throw err;
				});
		}

		// Wait for change that we care about
		let foundEvent = false;
		const watchPaths = getWatchPaths(project);
		const watcher = Deno.watchFs(watchPaths);
		verbose("Watching", watchPaths.join(", "));
		for await (const event of watcher) {
			const relevantPaths = event.paths.filter(shouldPathTriggerRebuild);
			if (relevantPaths.length > 0) {
				foundEvent = true;
				info("Change detected", `${event.kind}: ${relevantPaths.join(", ")}`);
				break;
			}
		}
		if (!foundEvent) {
			throw new InternalError("Unreachable: watchFs iterator ended");
		}

		// Abort previous build. Ignore if it's already aborted.
		try {
			fnAbortController?.abort("Rebuilding project due to file change.");
		} catch (err) {
			if (err.name != "AbortError") throw err;
		}

		// Try to reload project
		//
		// If this fails, it means the project is in a bad state. This will skip the next
		// action and wait for the next change.
		try {
			project = await loadProject({ path: project.path });
			loadProjectSuccess = true;
		} catch (err) {
			printError(err);
			loadProjectSuccess = false;
		}
	}
}

async function wrapWatchFn(
	project: Project,
	opts: WatchOpts,
	signal: AbortSignal,
) {
	// Gracefully handle errors
	try {
		await opts.fn(project, signal);
	} catch (err) {
		printError(err);
	}
}

function getWatchPaths(project: Project) {
	const paths: string[] = [
		resolve(project.path, "backend.yaml"),
	];
	for (const module of project.modules.values()) {
		if (
			!("local" in module.registry.config) ||
			module.registry.config.local.isExternal
		) continue;
		paths.push(module.path);
	}
	return paths;
}

function shouldPathTriggerRebuild(path: string) {
	const pathSplit = path.split(SEP);

	// Ignore generated files
	if (pathSplit.includes("_gen")) return false;

	// Prisma touches the db/migrations automatically, so we don't want to rebuild as a side effect
	const dbIdx = pathSplit.indexOf("db");
	if (dbIdx != -1 && pathSplit[dbIdx + 1] == "migrations") return false;

	return true;
}
