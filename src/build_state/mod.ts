import { Module, Project, Script } from "../project/mod.ts";
import { Cache, compareExprHash, compareFileHash, loadCache, writeCache } from "./cache.ts";
import { progress } from "../term/status.ts";
import { assert } from "../deps.ts";
import { CombinedError } from "../error/mod.ts";

// TODO: Convert this to a build flag
export const FORCE_BUILD = false;

/**
 * State for the current build process.
 */
export interface BuildState {
	project: Project;
	cache: Cache;
	promises: Promise<void>[];
}

export async function createBuildState(project: Project): Promise<BuildState> {
	const cache = await loadCache(project);

	// Build state
	const buildState: BuildState = {
		project,
		cache,
		promises: [],
	};

	return buildState;
}

export async function shutdownBuildState(buildState: BuildState) {
	await writeCache(buildState.project, buildState.cache);
}

interface BuildStepOpts {
	name: string;
	description?: string;

	/** Module this build step is relevant to. Only affects printed status. */
	module?: Module;

	/** Script this build step is relevant to. Only affects printed status. */
	script?: Script;

	/**
	 * If specified, this build step will only run if any of the conditions are met.
	 *
	 * If not specified, the build step will always run.
	 */
	condition?: BuildStepCondition;

	/**
	 * If true, the build step will not log until the start callback is called.
	 *
	 * This is useful for steps that are waiting on a queue to start the heavy
	 * workload for this buid step, such as uses of `runJob`.
	 */
	delayedStart?: boolean;

	/** Runs if the step is not cached. */
	build: (opts: BuildStepCallbackBuildOpts) => Promise<void>;

	/** Runs if the step is cached. */
	alreadyCached?: () => Promise<void>;

	/** Runs after the step finishes. */
	finally?: () => Promise<void>;
}

interface BuildStepCondition {
	/** Runs if any of these files are changed, created, or deleted. */
	files?: string[];

	/** Runs if any of these expressions change. */
	expressions?: Record<string, any>;
}

interface BuildStepCallbackBuildOpts {
	onStart: () => void;
}

/**
 * Plans a build step.
 */
export function buildStep(
	buildState: BuildState,
	opts: BuildStepOpts,
) {
	const fn = async () => {
		// Determine if needs to be built
		let needsBuild: boolean;
		if (FORCE_BUILD || opts.condition === undefined) {
			needsBuild = true;
		} else {
			// Both of these are evaluated since both need to be persisted to the
			// cache if they change. Otherwise, if both a file and expr is change,
			// the next build will have a false positive when it hashes the
			// expression.
			const fileDiff = opts.condition?.files ? await compareFileHash(buildState.cache, opts.condition.files) : false;
			const exprDiff = opts.condition?.expressions
				? await compareExprHash(buildState.cache, opts.condition.expressions)
				: false;

			needsBuild = fileDiff || exprDiff;
		}

		// TODO: max parallel build steps
		// TODO: error handling
		if (needsBuild) {
			let onStart: () => void | undefined;
			if (opts.delayedStart) {
				// Wait to log start
				onStart = () => logBuildStepStart(opts);
			} else {
				// Log start immediately
				logBuildStepStart(opts);
				onStart = () => {
					console.warn(`onStart was called for ${opts.name} but it can't have a delayed start`);
				};
			}

			await opts.build({
				onStart,
			});
		} else {
			if (opts.alreadyCached) await opts.alreadyCached();
		}

		if (opts.finally) await opts.finally();
	};

	buildState.promises.push(fn());
}

function logBuildStepStart(opts: BuildStepOpts) {
	progress(opts.name, opts.description);
}

export async function waitForBuildPromises(buildState: BuildState): Promise<void> {
	// Waits for all pending build promises. Do this in a loop in case a build
	// step spawns more build steps.
	while (buildState.promises.length > 0) {
		const promises = buildState.promises;
		buildState.promises = [];
		const responses = await Promise.allSettled(promises);

		// Build error if needed
		const errorResponses = responses
			.filter((response) => response.status === "rejected")
			.map((response) => {
				assert(response.status === "rejected");
				return response.reason;
			});
		if (errorResponses.length > 0) {
			throw new CombinedError(errorResponses);
		}
	}
}
