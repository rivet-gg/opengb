import { metaPath, type Project } from "../project/mod.ts";
import {
	createFactory,
	Hono,
	type MiddlewareHandler,
	type Mutex,
	serveStatic as baseServeStatic,
	type ServeStaticOptions,
	stream,
	validator,
} from "./deps.ts";
import { ProjectConfigSchema } from "../config/project.ts";
import { resolve } from "../deps.ts";

interface Env {
	Variables: {
		project: Project;
		mutex: Mutex;
	};
}

export const internalApi = new Hono<Env>()
	.get("/project.json", (c) => c.json(c.get("project")))
	.get("/meta.json", (c) => {
		c.header("Content-Type", "application/json");
		return stream(c, async (stream) => {
			const output = await Deno.open(metaPath(c.get("project")), { read: true });
			await stream.pipe(output.readable);
		});
	})
	.patch(
		"/config",
		validator("json", (value, c) => {
			const result = ProjectConfigSchema.omit({ registries: true, runtime: true }).safeParse(value);
			if (!result.success) {
				return c.json({ error: "Invalid body" }, 400);
			}
			return result.data;
		}),
		async (c) => {
			const existingConfig = await Deno.readTextFile(
				resolve(c.get("project").path, "backend.json"),
			);
			await c.get("mutex").acquire();
			await Deno.writeTextFile(
				resolve(c.get("project").path, "backend.json"),
				JSON.stringify({ ...JSON.parse(existingConfig), modules: c.req.valid("json").modules }, null, "\t"),
			);

			await c.get("mutex").waitForUnlock();
			return c.body(null, 204);
		},
	);

export type InternalApi = typeof internalApi;

// copied and modified from `@hono/hono/deno -> serveStatic.ts`
const serveStaticWebArtifacts = <E extends Env = Env>(
	options: ServeStaticOptions<E>,
): MiddlewareHandler => {
	return async function serveStatic(c, next) {
		const getContent = async (path: string) => {
			try {
				const file = await Deno.open(path);
				return file ? (file.readable as any) : null;
			} catch (e) {
				console.warn(`${e}`);
			}
		};
		const pathResolve = (path: string) => {
			const root = resolve(import.meta.dirname!, "./", "..", "..", "..", "..", "artifacts", "web");
			return `${root}/${path}`;
		};
		return baseServeStatic({
			...options,
			getContent,
			pathResolve,
		})(c, next);
	};
};

export function createProjectInternalApiRouter(project: Project, mutex: Mutex) {
	const factory = createFactory<Env>({
		initApp: (app) => {
			app.use(async (c, next) => {
				c.set("project", project);
				c.set("mutex", mutex);

				await mutex.waitForUnlock();
				await next();
			});
		},
	});

	const app = factory.createApp();

	app.route("/__internal", internalApi);
	app.get(
		"/*",
		serveStaticWebArtifacts({ root: "/" }),
	);

	return app;
}
