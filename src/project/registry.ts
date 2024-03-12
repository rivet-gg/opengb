import { emptyDir, exists, resolve } from "../deps.ts";
import { RegistryConfig, RegistryConfigGit, RegistryConfigLocal } from "../config/project.ts";
import { progress, warn } from "../term/status.ts";
import { UnreachableError, UserError } from "../error/mod.ts";
import { CommandError } from "../error/mod.ts";

export interface Registry {
	path: string;
	name: string;
	config: RegistryConfig;

	/**
	 * If the source code for this registry does not belong to this project.
	 *
	 * If true, modules will be copied to the _gen dir and will be read-only.
	 *
	 * If this is true, the module should be treated as read-only and should not
	 * be tested, formatted, linted, and generate Prisma migrations.
	 */
	isExternal: boolean;
}

/**
 * Clones a registry to the local machine if required and returns the path.
 */
export async function loadRegistry(
	projectRoot: string,
	name: string,
	config: RegistryConfig,
	signal?: AbortSignal,
): Promise<Registry> {
	let output: ResolveRegistryOutput;
	if ("local" in config) {
		output = await resolveRegistryLocal(projectRoot, name, config.local);
	} else if ("git" in config) {
		output = await resolveRegistryGit(projectRoot, name, config.git, signal);
	} else {
		// Unknown project config
		throw new UnreachableError(config);
	}

	return {
		path: output.path,
		name,
		config,
		isExternal: output.isExternal,
	};
}

export async function loadDefaultRegistry(projectRoot: string, signal?: AbortSignal): Promise<Registry> {
	return await loadRegistry(
		projectRoot,
		"default",
		{
			git: {
				url: {
					https: "https://github.com/rivet-gg/opengb-registry.git",
					ssh: "git@github.com:rivet-gg/opengb-registry.git",
				},
				// TODO: https://github.com/rivet-gg/opengb/issues/151
				rev: "e613227f95e0d584f611947e1b8d8c0e3ca508c8",
				directory: "./modules",
			},
		},
		signal,
	);
}

interface ResolveRegistryOutput {
	path: string;
	isExternal: boolean;
}

async function resolveRegistryLocal(
	projectRoot: string,
	name: string,
	config: RegistryConfigLocal,
): Promise<ResolveRegistryOutput> {
	const projectConfigPath = resolve(projectRoot, "backend.yaml");

	const isExternal = config.isExternal ?? false;

	// Check that registry exists
	const path = resolve(projectRoot, config.directory);
	if (!await exists(path)) {
		throw new UserError(`Could not find directory ${path} for local registry \`${name}\`.`, {
			path: projectConfigPath,
		});
	}

	return { path, isExternal };
}

async function resolveRegistryGit(
	projectRoot: string,
	name: string,
	config: RegistryConfigGit,
	signal?: AbortSignal,
): Promise<ResolveRegistryOutput> {
	const projectConfigPath = resolve(projectRoot, "backend.yaml");

	const repoPath = resolve(projectRoot, "_gen", "git_registries", name);
	const gitRef = resolveGitRef(config);

	// Clone repo if needed
	if (!await exists(resolve(repoPath, ".git"))) {
		// List what remote endpoints to try
		//
		// This is important since we don't know if the user is authenticated with Git via SSH or HTTPS
		const urlList = [];
		if (typeof config.url === "string") {
			urlList.push(config.url);
		} else if (typeof config === "object") {
			if (config.url.https) urlList.push(config.url.https);
			if (config.url.ssh) urlList.push(config.url.ssh);
		}

		// Test each endpoint
		let originUrl: string | undefined;
		let errorOutput = "";
		for (const url of urlList) {
			const lsRemoteCommand = await new Deno.Command("git", {
				args: ["ls-remote", url],
				signal,
			}).output();
			if (lsRemoteCommand.success) {
				originUrl = url;
				errorOutput = new TextDecoder().decode(lsRemoteCommand.stderr);
				break;
			}
		}

		// If no valid endpoint was found
		if (!originUrl) {
			throw new UserError(`Git endpoint for registry \`${name}\` is unreachable:\n\n${errorOutput}`, {
				path: projectConfigPath,
			});
		}

		progress("Fetching", originUrl);

		// Remove potentially dirty existing directory
		await emptyDir(repoPath);

		// Clone repo
		const cloneOutput = await new Deno.Command("git", {
			args: ["clone", "--single-branch", originUrl, repoPath],
			signal,
		}).output();
		if (!cloneOutput.success) {
			throw new CommandError(
				`Failed to clone registry ${originUrl}.`,
				{ commandOutput: cloneOutput },
			);
		}
	}

	// Discard any changes
	const unstagedDiffOutput = await new Deno.Command("git", {
		cwd: repoPath,
		args: ["diff", "--quiet"],
		signal,
	}).output();
	const stagedDiffOutput = await new Deno.Command("git", {
		cwd: repoPath,
		args: ["diff", "--quiet", "--cached"],
		signal,
	}).output();
	if (!unstagedDiffOutput.success || !stagedDiffOutput.success) {
		warn("💣 Discarding changes in git registry", name);

		const resetOutput = await new Deno.Command("git", {
			cwd: repoPath,
			args: ["reset", "--hard"],
			signal,
		}).output();
		if (!resetOutput.success) {
			throw new CommandError(
				`Failed to reset registry ${name}.`,
				{ commandOutput: resetOutput },
			);
		}
	}

	// Check if rev exists locally, if not try fetch it
	const catOutput = await new Deno.Command("git", {
		cwd: repoPath,
		args: ["cat-file", "-t", gitRef],
		signal,
	}).output();
	if (!catOutput.success) {
		progress("Fetching", name);

		const fetchOutput = await new Deno.Command("git", {
			cwd: repoPath,
			args: ["fetch", "origin", gitRef],
			signal,
		}).output();
		if (!fetchOutput.success) {
			throw new CommandError(
				`Failed to fetch registry ${name} at ${gitRef}.`,
				{ commandOutput: fetchOutput },
			);
		}
	}

	// Checkout commit
	const checkoutOutput = await new Deno.Command("git", {
		cwd: repoPath,
		args: ["checkout", gitRef],
		signal,
	}).output();
	if (!checkoutOutput.success) {
		throw new CommandError(
			`Failed to checkout registry ${name} at ${gitRef}.`,
			{ commandOutput: checkoutOutput },
		);
	}

	// Join sub directory
	const path = resolve(repoPath, config.directory ?? "");
	if (!await exists(path)) {
		throw new UserError(`Could not find directory ${config.directory} for git registry \`${name}\`.`, {
			path: projectConfigPath,
		});
	}

	return { path, isExternal: true };
}

function resolveGitRef(registryConfig: RegistryConfigGit): string {
	if ("rev" in registryConfig) {
		return registryConfig.rev;
	} else if ("branch" in registryConfig) {
		return registryConfig.branch;
	} else if ("tag" in registryConfig) {
		return `tags/${registryConfig.tag}`;
	} else {
		throw new UnreachableError(registryConfig);
	}
}
