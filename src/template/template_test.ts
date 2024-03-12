import { DbDriver } from "../build/mod.ts";
import { build, Format, Runtime } from "../build/mod.ts";
import { resolve } from "../deps.ts";
import { loadProject } from "../project/mod.ts";
import { dedent } from "./deps.ts";
import { templateModule } from "./module.ts";
import { templateProject } from "./project.ts";
import { templateScript } from "./script.ts";

Deno.test({
	name: "e2e",

	// TODO: https://github.com/rivet-gg/opengb-engine/issues/35
	sanitizeOps: false,
	sanitizeResources: false,

	async fn() {
		const path = await Deno.makeTempDir();

		await templateProject(path);

		await templateModule(await loadProject({ path }), "module_a");

		// Append test model to schema
		const schemaPath = resolve(path, "modules", "module_a", "db", "schema.prisma");
		let schema = await Deno.readTextFile(schemaPath);
		schema += dedent`
			model User {
				id    String   @id @default(uuid()) @db.Uuid
				email String   @unique
				name  String?
			}
		`;
		await Deno.writeTextFile(schemaPath, schema);

		await templateScript(await loadProject({ path }), "module_a", "script_a");

		await build(await loadProject({ path }), {
			format: Format.Native,
			runtime: Runtime.Deno,
			dbDriver: DbDriver.NodePostgres,
			skipDenoCheck: false,
		});
	},
});
