import { z as zod } from "./deps.ts";
import { AnySchemaElement, is } from "./schema.ts";

export { schemaElements } from "./schema.ts";
export { createSchemaSerializer } from "./serializer.ts";

export * from "./schema.ts";
export * from "./deserializer.ts";

export { convertZodToSerializedSchema } from "./serializer.ts";

export const convertSchemaToZod = (
	schema: AnySchemaElement,
): zod.ZodTypeAny => {
	if (is("unknown", schema)) {
		return zod.unknown();
	}
	if (is("optional", schema)) {
		return zod.optional(convertSchemaToZod(schema.value));
	}
	if (is("date", schema)) {
		return zod.date();
	}
	if (is("string", schema)) {
		return zod.string();
	}
	if (is("number", schema)) {
		return zod.number();
	}
	if (is("boolean", schema)) {
		return zod.boolean();
	}
	if (is("undefined", schema)) {
		return zod.undefined();
	}
	if (is("null", schema)) {
		return zod.null();
	}
	if (is("any", schema)) {
		return zod.any();
	}
	if (is("literal", schema)) {
		return zod.literal(schema.value);
	}
	if (is("tuple", schema)) {
		const [schemaA, schemaB, ...schemas] = schema.items.map(convertSchemaToZod);
		return zod.tuple([schemaA!, schemaB!, ...schemas]);
	}
	if (is("array", schema)) {
		return zod.array(convertSchemaToZod(schema.item));
	}
	if (is("intersection", schema)) {
		return zod.intersection(
			convertSchemaToZod(schema.left),
			convertSchemaToZod(schema.right),
		);
	}
	if (is("union", schema)) {
		const [schemaA, schemaB, ...schemas] = schema.items.map(convertSchemaToZod);
		return zod.union([schemaA!, schemaB!, ...schemas]);
	}
	if (is("nullable", schema)) {
		return zod.nullable(convertSchemaToZod(schema.item));
	}
	if (is("object", schema)) {
		return zod.object(
			Object.fromEntries(
				Object.entries(schema.properties).map((
					[name, type],
				) => [name, convertSchemaToZod(type)]),
			),
		).strict();
	}
	if (is("record", schema)) {
		return zod.record(convertSchemaToZod(schema.elementType));
	}

	return zod.unknown();
};

export const convertSerializedSchemaToZod = (
	serializedSchema: AnySchemaElement,
) => {
	return convertSchemaToZod(serializedSchema);
};
