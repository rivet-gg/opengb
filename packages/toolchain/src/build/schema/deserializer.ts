import { CodeBlockWriter, Project, VariableDeclarationKind } from "./deps.ts";
import { AnySchemaElement, is, s } from "./schema.ts";

interface GenerateOptions {
	/**
	 * The name of the interface to generate.
	 */
	name: string;
}

export function convertSerializedSchemaToTypeScript(schema: AnySchemaElement, options: GenerateOptions) {
	const project = new Project();

	const sourceFile = project.createSourceFile("main.ts");

	if (is("object", schema)) {
		sourceFile.insertText(0, (writer) => {
			writer.write(`interface ${options.name}`);
			writeTSSourceCode(writer, schema);
		});
	} else {
		sourceFile.addTypeAlias({ name: options.name, type: (writer) => writeTSSourceCode(writer, schema) });
	}
	return sourceFile.getText();
}

export function convertSerializedSchemaToZodConstant(
	schema: AnySchemaElement,
	options: GenerateOptions & { export?: boolean },
) {
	const project = new Project();

	const sourceFile = project.createSourceFile("main.ts");

	sourceFile.addVariableStatement({
		declarationKind: VariableDeclarationKind.Const,
		isExported: options.export,
		declarations: [{
			name: options.name,
			initializer: (writer) => writeZodSourceCode(writer, schema),
		}],
	});
	return sourceFile.getText();
}

export function convertSerializedSchemaToZodExpression(schema: AnySchemaElement) {
	return writeZodSourceCode(new CodeBlockWriter(), schema).toString();
}

function writeTSSourceCode(writer: CodeBlockWriter, schema: AnySchemaElement): CodeBlockWriter {
	if (is("literal", schema)) {
		if (typeof schema.value === "string") {
			return writer.quote(schema.value);
		}
		return writer.write(`${schema.value}`);
	}
	if (is("optional", schema)) {
		return writeTSSourceCode(writer, s.union([schema.value, s.undefined()]));
	}
	if (is("number", schema)) {
		return writer.write("number");
	}
	if (is("string", schema)) {
		return writer.write("string");
	}
	if (is("boolean", schema)) {
		return writer.write("boolean");
	}
	if (is("undefined", schema)) {
		return writer.write("undefined");
	}
	if (is("null", schema)) {
		return writer.write("null");
	}
	if (is("any", schema)) {
		return writer.write("any");
	}
	if (is("never", schema)) {
		return writer.write("never");
	}
	if (is("array", schema)) {
		writer.write("Array<");
		writeTSSourceCode(writer, schema.item);
		return writer.write(">");
	}
	if (is("intersection", schema)) {
		writeTSSourceCode(writer, schema.left);
		writer.write(" & ");
		return writeTSSourceCode(writer, schema.right);
	}
	if (is("union", schema)) {
		schema.items.forEach((item, index) => {
			writeTSSourceCode(writer, item);
			if (index < schema.items.length - 1) {
				writer.write(" | ");
			}
		});
		return writer;
	}
	if (is("nullable", schema)) {
		writeTSSourceCode(writer, schema.item);
		return writer.write(" | null");
	}
	if (is("object", schema)) {
		return writer.block(() => {
			Object.entries(schema.properties).forEach(([key, value], index, entries) => {
				const description = is("optional", value) ? value.description || value.value.description : value.description;
				if (description) {
					writer.writeLine(`/**`);
					writer.writeLine(` * ${description}`);
					writer.writeLine(` */`);
				}

				writer.write(`${key}`);
				if (is("optional", value)) {
					writer.write("?:");
					writeTSSourceCode(writer, value.value);
				} else {
					writer.write(": ");
					writeTSSourceCode(writer, value);
				}
				if (index < entries.length - 1) {
					writer.write(", ");
				}
			});
		});
	}
	if (is("tuple", schema)) {
		writer.write("[");
		schema.items.forEach((item, index) => {
			writeTSSourceCode(writer, item);
			if (index < schema.items.length - 1) {
				writer.write(", ");
			}
		});
		return writer.write("]");
	}
	if (is("unknown", schema)) {
		return writer.write("unknown");
	}
	if (is("date", schema)) {
		return writer.write("Date");
	}

	if (is("record", schema)) {
		writer.write("Record<string, ");
		writeTSSourceCode(writer, schema.elementType);
		return writer.write(">");
	}

	return writer;
}

function writeZodSourceCode(writer: CodeBlockWriter, schema: AnySchemaElement): CodeBlockWriter {
	if (is("unknown", schema)) {
		return writer.write(`z.unknown()`);
	}
	if (is("optional", schema)) {
		writer.writeLine(`z.optional(`);
		writeZodSourceCode(writer, schema.value);
		return writer.writeLine(`)`);
	}
	if (is("date", schema)) {
		return writer.write(`z.date()`);
	}
	if (is("string", schema)) {
		return writer.write(`z.string()`);
	}
	if (is("number", schema)) {
		return writer.write(`z.number()`);
	}
	if (is("boolean", schema)) {
		return writer.write(`z.boolean()`);
	}
	if (is("undefined", schema)) {
		return writer.write(`z.undefined()`);
	}
	if (is("null", schema)) {
		return writer.write(`z.null()`);
	}
	if (is("any", schema)) {
		return writer.write(`z.any()`);
	}
	if (is("literal", schema)) {
		const value = typeof schema.value === "string" ? `"${schema.value}"` : schema.value;
		return writer.write(`z.literal(${value})`);
	}
	if (is("tuple", schema)) {
		writer.write(`z.tuple([`);
		schema.items.forEach((item, index) => {
			writeZodSourceCode(writer, item);
			if (index < schema.items.length - 1) {
				writer.write(", ");
			}
		});
		return writer.write(`])`);
	}
	if (is("array", schema)) {
		writer.write(`z.array(`);
		writeZodSourceCode(writer, schema.item);
		return writer.write(`)`);
	}
	if (is("intersection", schema)) {
		const { left, right } = schema;
		writer.write(`z.intersection(`);
		writeZodSourceCode(writer, left);
		writer.write(`, `);
		writeZodSourceCode(writer, right);
		return writer.write(`)`);
	}
	if (is("union", schema)) {
		writer.write(`z.union([`);
		schema.items.forEach((item, index) => {
			writeZodSourceCode(writer, item);
			if (index < schema.items.length - 1) {
				writer.write(", ");
			}
		});
		return writer.write(`])`);
	}
	if (is("nullable", schema)) {
		writer.write(`z.nullable(`);
		writeZodSourceCode(writer, schema.item);
		return writer.write(`)`);
	}
	if (is("object", schema)) {
		writer.write(`z.object({`);
		Object.entries(schema.properties).forEach(([key, value], index, entries) => {
			writer.write(`${key}: `);
			writeZodSourceCode(writer, value);
			if (index < entries.length - 1) {
				writer.write(", ");
			}
		});
		return writer.write(`}).strict()`);
	}
	if (is("record", schema)) {
		writer.write(`z.record(`);
		writeZodSourceCode(writer, schema.elementType);
		return writer.write(`)`);
	}
	if (is("never", schema)) {
		return writer.write(`z.never()`);
	}
	return writer;
}
