import { dedent } from "../deps.ts";
import { dirname, formatPath, isAbsolute, parsePath, relative, resolve } from "../../deps.ts";
import { autoGenHeader } from "../misc.ts";

function ensureRelativePrefixed(path: string) {
	if (isAbsolute(path)) return path;

	const parsed = parsePath(path);
	if (parsed.dir.startsWith(".")) return path;
	else if (parsed.dir) return formatPath({ ...parsed, dir: `./${parsed.dir}` });
	else return formatPath({ ...parsed, dir: `.` });
}

export class GeneratedCodeBuilder {
	private sourceParts: string[] = [""];
	private chunks: GeneratedCodeBuilder[] = [];

	public constructor(
		public path?: string,
		private newlinesPerChunk = 2,
	) {}

	public static from(...args: Parameters<typeof dedent>) {
		const file = new GeneratedCodeBuilder();
		file.append(...args);
		return file;
	}

	public static fromRaw(raw: string, path?: string, newlinesPerChunk = 2) {
		const file = new GeneratedCodeBuilder(path, newlinesPerChunk);
		file.sourceParts = [raw];
		return file;
	}

	public get chunk() {
		const chunk = new GeneratedCodeBuilder(undefined, this.newlinesPerChunk);
		this.chunks.push(chunk);
		this.sourceParts.push(this.newlines);
		return chunk;
	}

	public static wrap(
		before: string,
		file: GeneratedCodeBuilder,
		after: string,
	) {
		file.prependRaw(before);
		file.appendRaw(after);
	}

	public clone() {
		const newGeneratedFile = new GeneratedCodeBuilder(this.path, this.newlinesPerChunk);
		newGeneratedFile.sourceParts = [...this.sourceParts];
		newGeneratedFile.chunks = this.chunks.map((chunk) => chunk.clone());
		return newGeneratedFile;
	}

	public withNewlinesPerChunk(newlinesPerChunk: number) {
		this.newlinesPerChunk = newlinesPerChunk;
		return this;
	}

	public withPath(path?: string) {
		this.path = path;
		return this;
	}

	private get newlines() {
		return "\n".repeat(this.newlinesPerChunk);
	}
	private get last() {
		return this.sourceParts.length - 1;
	}
	public relative(...pathSegments: string[]) {
		if (!this.path) throw new Error("Cannot get relative path of a file without a path");

		const denoRelative = relative(dirname(this.path), resolve(...pathSegments));

		// relative("a/b/c", "a/b/c/d.ts") returns "d.ts", but we want "./d.ts"
		return ensureRelativePrefixed(denoRelative);
	}

	public newline() {
		this.sourceParts[this.last] += "\n";
		return this;
	}

	public prependRaw(newChunk: string) {
		this.sourceParts[0] = newChunk + this.newlines + this.sourceParts[0];
		return this;
	}
	public appendRaw(newChunk: string) {
		this.sourceParts[this.last] += newChunk + this.newlines;
		return this;
	}

	private dedent(...args: Parameters<typeof dedent>) {
		const massagedValues = args.slice(1).map((arg) => {
			if (arg instanceof GeneratedCodeBuilder) return arg.toString(false);
			else return arg;
		});
		return dedent(args[0], ...massagedValues);
	}

	public prepend(...args: Parameters<typeof dedent>) {
		this.prependRaw(this.dedent(...args));
		return this;
	}
	public append(...args: Parameters<typeof dedent>) {
		this.appendRaw(this.dedent(...args));
		return this;
	}

	public push(...files: GeneratedCodeBuilder[]) {
		for (const file of files) {
			this.appendRaw(file.toString(false));
		}
		return this;
	}

	public async write(fmt: boolean = true) {
		if (!this.path) throw new Error("Cannot write a file without a path");

		if (fmt) {
			await mkdirWriteFmt(this.path, this.toString(true));
		} else {
			await mkdirFor(this.path);
			await Deno.writeTextFile(this.path, this.toString(true));
		}
	}

	public toString(includeHeader = true) {
		const chunks = this.chunks.map((chunk) => chunk.toString(false));

		let source = "";

		for (let i = 0; i < this.sourceParts.length; i++) {
			source += this.sourceParts[i];
			if (chunks[i]) source += chunks[i];
		}

		if (includeHeader) {
			return `${autoGenHeader()}${this.newlines}${source}`;
		} else {
			return source;
		}
	}
}

async function mkdirFor(path: string) {
	await Deno.mkdir(dirname(path), { recursive: true });
}
async function writeFmt(path: string, source: string) {
	await Deno.writeTextFile(path, source);
	const formatResult = await new Deno.Command("deno", {
		args: ["fmt", path],
	}).output();
	if (!formatResult.success) {
		throw new Error(
			`Failed to format ${path}`,
			{ cause: new TextDecoder().decode(formatResult.stderr) },
		);
	}
}

async function mkdirWriteFmt(path: string, source: string) {
	await mkdirFor(path);
	await writeFmt(path, source);
}
