import { assertEquals } from "https://deno.land/std@0.220.1/assert/mod.ts";
import dedent from "https://esm.sh/dedent@^1.5.3";

import { convertSerializedSchemaToTypeScript } from "./mod.ts";
import { s } from "./schema.ts";

const assert = (actual: string, expected: string) =>
	assertEquals(
		dedent(actual),
		dedent(expected),
	);

([
	["any", s.any],
	["string", s.string],
	["number", s.number],
	["boolean", s.boolean],
	["undefined", s.undefined],
	["null", s.null],
] as const).forEach(([name, value]) => {
	Deno.test(`schema deserializer should handle primitive type '${name}'`, () => {
		assert(convertSerializedSchemaToTypeScript(value(), { name: "Type" }), `type Type = ${name};`);
	});
});

Deno.test("schema deserializer should handle literal type", () => {
	const schema = s.object({
		value: s.literal("hello"),
	});

	assert(
		convertSerializedSchemaToTypeScript(schema, { name: "Type" }),
		`interface Type {
		value: "hello"
		}`,
	);
});

Deno.test("schema deserializer should handle optional type", () => {
	const schema = s.object({
		value: s.optional(s.string()),
	});

	assert(
		convertSerializedSchemaToTypeScript(schema, { name: "Type" }),
		`interface Type {
		value?:string
		}`,
	);
});

Deno.test("schema deserializer should handle array ([]) type", () => {
	const schema = s.object({
		value: s.array(s.string()),
	});

	assert(
		convertSerializedSchemaToTypeScript(schema, { name: "Type" }),
		`interface Type {
		value: Array<string>
		}`,
	);
});

Deno.test("schema deserializer should handle tuple type", () => {
	const schema = s.object({
		value: s.tuple([
			s.string(),
			s.number(),
		]),
	});

	assert(
		convertSerializedSchemaToTypeScript(schema, { name: "Type" }),
		`interface Type {
		value: [string, number]
		}`,
	);
});

Deno.test("schema deserializer should handle never type", () => {
	const schema = s.object({
		value: s.never(),
	});

	assert(
		convertSerializedSchemaToTypeScript(schema, { name: "Type" }),
		`interface Type {
		value: never
		}`,
	);
});

Deno.test("schema deserializer should handle intersection type", () => {
	const schema = s.object({
		value: s.intersection(
			s.object({ valueA: s.string() }),
			s.object({ valueB: s.number() }),
		),
	});

	assert(
		convertSerializedSchemaToTypeScript(schema, { name: "Type" }),
		`interface Type {
		value: {
		    valueA: string
		}
		 & {
		    valueB: number
		}
		}`,
	);
});

Deno.test("schema deserializer should handle union type", () => {
	const schema = s.object({
		value: s.union([
			s.string(),
			s.number(),
		]),
	});

	assert(
		convertSerializedSchemaToTypeScript(schema, { name: "Type" }),
		`interface Type {
		value: string | number
		}`,
	);
});

Deno.test("schema deserializer should handle nullable type", () => {
	const schema = s.object({
		value: s.nullable(s.string()),
	});

	assert(
		convertSerializedSchemaToTypeScript(schema, { name: "Type" }),
		`interface Type {
		value: string | null
		}`,
	);
});

Deno.test("schema deserializer should handle object type", () => {
	const schema = s.object({
		value: s.object({
			a: s.string(),
			b: s.number(),
		}),
	});

	assert(
		convertSerializedSchemaToTypeScript(schema, { name: "Type" }),
		`interface Type {
		value: {
		    a: string, b: number
		}
		}`,
	);
});

Deno.test("schema deserializer should handle Record type", () => {
	const schema = s.object({
		value: s.record(s.string()),
	});

	assert(
		convertSerializedSchemaToTypeScript(schema, { name: "Type" }),
		`interface Type {
		value: Record<string, string>
		}`,
	);
});

Deno.test("schema deserializer should handle Date type", () => {
	const schema = s.object({
		value: s.date(),
	});

	assert(
		convertSerializedSchemaToTypeScript(schema, { name: "Type" }),
		`interface Type {
		value: Date
		}`,
	);
});

Deno.test("schema deserializer should handle unknown type", () => {
	const schema = s.object({
		value: s.unknown(),
	});

	assert(
		convertSerializedSchemaToTypeScript(schema, { name: "Type" }),
		`interface Type {
		value: unknown
		}`,
	);
});
