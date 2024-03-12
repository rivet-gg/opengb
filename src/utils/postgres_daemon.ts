import { CommandError, UserError } from "../error/mod.ts";
import { Project } from "../project/mod.ts";
import { verbose } from "../term/status.ts";
import { createOnce, getOrInitOnce } from "./once.ts";

const CONTAINER_NAME = "opengb-postgres";
const VOLUME_NAME = "opengb-postgres-data";

const POSTGRES_ONCE = createOnce<void>();

/**
 * Ensures that Postgres server is running for development.
 */
export async function ensurePostgresRunning(project: Project) {
	return await getOrInitOnce(POSTGRES_ONCE, async () => {
		await ensurePostgresRunningInner(project);
	});
}

async function ensurePostgresRunningInner(_project: Project) {
	verbose("Starting Postgres server...");

	// Validate Docker is installed
	const versionOutput = await new Deno.Command("docker", {
		args: ["version"],
		stdout: "piped",
		stderr: "piped",
	}).output();
	if (!versionOutput.success) {
		throw new UserError(
			"Docker is not installed or running.",
			{
				suggest: "Install here: https://docs.docker.com/get-docker/",
			},
		);
	}

	// Check if volume already exists
	const volumeOutput = await new Deno.Command("docker", {
		args: ["volume", "ls", "-q", "-f", `name=${VOLUME_NAME}`],
		stdout: "piped",
	}).output();
	const volumeId = new TextDecoder().decode(volumeOutput.stdout).trim();
	if (!volumeId) {
		// Create the volume
		const volumeCreateOutput = await new Deno.Command("docker", {
			args: ["volume", "create", VOLUME_NAME],
		}).output();
		if (!volumeCreateOutput.success) {
			throw new CommandError("Failed to create Postgres volume.", { commandOutput: volumeCreateOutput });
		}
	}

	// Remove the existing container if exists. This forces the new
	// configuration for a new container.
	const rmOutput = await new Deno.Command("docker", {
		args: ["rm", "-f", CONTAINER_NAME],
	}).output();
	if (!rmOutput.success) {
		throw new CommandError("Failed to remove the existing Postgres container.", { commandOutput: rmOutput });
	}

	// Start the container
	const runOutput = await new Deno.Command("docker", {
		args: [
			"run",
			"-d",
			"--name",
			CONTAINER_NAME,
			"-v",
			`${VOLUME_NAME}:/var/lib/postgresql/data`,
			"-p",
			"5432:5432",
			"-e",
			"POSTGRES_PASSWORD=postgres",
			"postgres:16",
		],
	}).output();
	if (!runOutput.success) {
		throw new CommandError("Failed to start the Postgres container.", { commandOutput: runOutput });
	}

	verbose("Waiting for pg_isready");

	// Wait until Postgres is accessible
	while (true) {
		const checkOutput = await new Deno.Command("docker", {
			args: ["exec", CONTAINER_NAME, "pg_isready"],
		}).output();
		if (checkOutput.success) break;
		await new Promise((r) => setTimeout(r, 50));
	}

	// HACK: https://github.com/rivet-gg/opengb/issues/200
	// CI needs a bit more time to be able to connect to the server
	if (Deno.env.get("CI") === "true") {
		await new Promise((r) => setTimeout(r, 1000));
	}

	verbose("Ready");
}
