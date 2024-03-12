import { copy, resolve } from "../deps.ts";
import { dedent } from "./deps.ts";
import { Module, Project } from "../project/mod.ts";
import { CommandError, UserError } from "../error/mod.ts";
import { addShutdownHandler } from "../utils/shutdown_handler.ts";
import { verbose } from "../term/status.ts";
import { NODE_CONTAINER_NAME, NODE_IMAGE, PRISMA_VERSION } from "./mod.ts";
import { createOnce, getOrInitOnce } from "../utils/once.ts";

function getPrismaDir(project: Project) {
	return resolve(project.path, "_gen", "prisma_workspace");
}

const PRISMA_WORKSPACE_ONCE = createOnce<void>();

/**
 * Installs a copy of Prisma in to a directory that can be reused for any
 * Prisma-related commands.
 *
 * All commands are ran inside a Node Docker container in order to ensure we
 * don't need Node installed on the host.
 */
async function ensurePrismaWorkspace(project: Project): Promise<void> {
	return await getOrInitOnce(PRISMA_WORKSPACE_ONCE, async () => {
		return await ensurePrismaWorkspaceInner(project);
	});
}

async function ensurePrismaWorkspaceInner(project: Project): Promise<void> {
	const prismaDir = getPrismaDir(project);
	verbose("Setting up Prisma workspace", prismaDir);

	await Deno.mkdir(prismaDir, { recursive: true });

	// Remove the existing container if exists. This forces the new
	// configuration for a new container.
	verbose("Removing old container", NODE_CONTAINER_NAME);
	const rmOutput = await new Deno.Command("docker", {
		args: ["rm", "-f", NODE_CONTAINER_NAME],
	}).output();
	if (!rmOutput.success) {
		throw new CommandError("Failed to remove the existing container.", { commandOutput: rmOutput });
	}

	// Start the container
	verbose("Starting container", `${NODE_CONTAINER_NAME} (${NODE_IMAGE})`);
	const runOutput = await new Deno.Command("docker", {
		args: [
			"run",
			"-d",
			"--rm",
			`--name=${NODE_CONTAINER_NAME}`,
			"--add-host=host.docker.internal:host-gateway",
			`--volume=${prismaDir}:/prisma`,
			"--entrypoint=sleep",
			NODE_IMAGE,
			// ===
			"infinity",
		],
	}).output();
	if (!runOutput.success) {
		throw new CommandError("Failed to start the container.", { commandOutput: runOutput });
	}

	// Shutdown the container when the process exits
	addShutdownHandler(shutdownNodeContainer);

	// Write package.json
	const packageJson = JSON.stringify({
		"devDependencies": {
			"prisma": `^${PRISMA_VERSION}`,
		},
		"dependencies": {
			"@prisma/client": `^${PRISMA_VERSION}`,
		},
	});
	await Deno.writeTextFile(resolve(prismaDir, "package.json"), packageJson);

	// Fix permissions on the repo
	const chownOutput = await new Deno.Command("docker", {
		args: [
			"exec",
			NODE_CONTAINER_NAME,
			// ===
			"chown",
			"-R",
			"node:node",
			"/prisma",
		],
	}).output();
	if (!chownOutput.success) throw new CommandError("Failed to fix permissions.", { commandOutput: chownOutput });

	// Install dependencies
	verbose("Installing dependencies", NODE_CONTAINER_NAME);
	const installOutput = await new Deno.Command("docker", {
		args: [
			"exec",
			"--workdir=/prisma",
			`--user=node:node`,
			NODE_CONTAINER_NAME,
			// ===
			"npm",
			"install",
			"--prefer-offline",
			"--no-audit",
			"--no-fund",
			"--progress=false",
		],
	}).output();
	if (!installOutput.success) {
		throw new CommandError("Failed to install prisma dependencies.", { commandOutput: installOutput });
	}

	// Fix permissions on the repo
	const chownOutput2 = await new Deno.Command("docker", {
		args: [
			"exec",
			NODE_CONTAINER_NAME,
			// ===
			"chown",
			"-R",
			`${Deno.uid()}:${Deno.gid()}`,
			"/prisma",
		],
	}).output();
	if (!chownOutput2.success) throw new CommandError("Failed to fix permissions.", { commandOutput: chownOutput2 });

	verbose("Prisma workspace init complete", prismaDir);
}
/**
 * Shutdown the Node helper container.
 *
 * This is sync so it can run in `unload`.
 */

async function shutdownNodeContainer() {
	verbose("Shutting down Node container", NODE_CONTAINER_NAME);
	const shutdownOutput = await new Deno.Command("docker", {
		args: ["rm", "-f", NODE_CONTAINER_NAME],
	}).output();
	if (!shutdownOutput.success) {
		throw new CommandError("Failed to stop the container.", { commandOutput: shutdownOutput });
	}
}

export interface RunPrismaCommandOpts {
	args: string[];
	env: Record<string, string>;
	interactive: boolean;
	output: boolean;
	signal?: AbortSignal;
}
/**
 * Run a Prisma command in the Prisma workspace inside the Docker container. The
 * CWD is set to the `db` directory.
 *
 * We don't use `deno run npm:prisma` because:
 *
 * - We already have Prisma installed in the workspace
 * - There are minor bugs with Deno's compatability with Prisma
 */

export async function runPrismaCommand(
	project: Project,
	module: Module,
	opts: RunPrismaCommandOpts,
): Promise<string> {
	await ensurePrismaWorkspace(project);

	// Validate terminal
	if (opts.interactive && !Deno.stdin.isTerminal()) {
		throw new UserError("Cannot run this command without a terminal.", {
			suggest:
				"This is likely because you're running from a non-interactive shell, such as a CI environment., Run this command in a terminal that supports TTY.",
		});
	}

	const signal = opts.signal;

	// Unique isolated folder for this command to run in. This runs in the Prisma
	// workspace where Prisma is already installed.
	const prismaDir = getPrismaDir(project);
	const worksapceId = crypto.randomUUID();
	const dbDirHost = resolve(prismaDir, "db", worksapceId);
	await Deno.mkdir(dbDirHost, { recursive: true });
	verbose("Setting up Prisma command dir", dbDirHost);

	// Force POSIX paths since this is in a Docker container.
	const dbDirContainer = `/prisma/db/${worksapceId}`;

	// Copy database
	await copy(resolve(module.path, "db"), dbDirHost, { overwrite: true });

	// Append generator config
	const schemaPath = resolve(dbDirHost, "schema.prisma");
	let schema = await Deno.readTextFile(schemaPath);
	schema += dedent`
		// Generated by Open Game Backend
		generator client {
			provider = "prisma-client-js"
			output = "${dbDirContainer}/client"
			previewFeatures = ["driverAdapters"]
		}
	`;
	await Deno.writeTextFile(schemaPath, schema);

	// HACK: Replace the host with the Docker gateway. This isn't a failsave solution.
	if (opts.env.DATABASE_URL) {
		opts.env.DATABASE_URL = opts.env.DATABASE_URL
			.replace("localhost", "host.docker.internal")
			.replace("127.0.0.1", "host.docker.internal")
			.replace("0.0.0.0", "host.docker.internal");
	}

	const envFlags = Object.entries(opts.env).map(([key, value]) => `--env=${key}=${value}`);

	// Make the directory usable by the Node container
	const chownOutput = await new Deno.Command("docker", {
		args: [
			"exec",
			NODE_CONTAINER_NAME,
			// ===
			"chown",
			"-R",
			"node:node",
			dbDirContainer,
		],
		signal,
	}).output();
	if (!chownOutput.success) throw new CommandError("Failed to fix permissions.", { commandOutput: chownOutput });

	// Run the command
	verbose("Running Prisma command", `${dbDirHost}: prisma ${opts.args.join(" ")}`);
	const prismaOutput = await new Deno.Command("docker", {
		args: [
			"exec",
			...(opts.interactive ? ["-it"] : []),
			`--workdir=${dbDirContainer}`,
			`--user=node:node`,
			...envFlags,
			NODE_CONTAINER_NAME,
			"/prisma/node_modules/.bin/prisma",
			...opts.args,
		],
		stdin: opts.interactive ? "inherit" : undefined,
		stdout: opts.output ? "inherit" : undefined,
		stderr: opts.output ? "inherit" : undefined,
		env: opts.env,
		signal,
	}).output();
	if (!prismaOutput.success) {
		throw new CommandError(`Failed to run: prisma ${opts.args.join(" ")}`, { commandOutput: prismaOutput });
	}

	// Fix permissions to be readable by the host
	const chownOutput2 = await new Deno.Command("docker", {
		args: [
			"exec",
			NODE_CONTAINER_NAME,
			// ===
			"chown",
			"-R",
			`${Deno.uid()}:${Deno.gid()}`,
			dbDirContainer,
		],
		signal,
	}).output();
	if (!chownOutput2.success) throw new CommandError("Failed to fix permissions.", { commandOutput: chownOutput2 });

	// TODO: Clean up the workspace?
	return dbDirHost;
}
