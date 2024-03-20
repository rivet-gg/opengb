import { assertEquals } from "https://deno.land/std@0.220.1/assert/mod.ts";

import { createSchemaSerializer, schemaElements } from "./mod.ts";

Deno.test("schema serializer should handle simple inheritance", () => {
	const code = `
        interface _SubType {
            value: string;
        }
        interface Type extends _SubType {
            expires: string;
        }
    `;

	const serializer = createSchemaSerializer({ code });
	assertEquals(
		serializer.serialize("Type"),
		schemaElements.object({
			value: schemaElements.string(),
			expires: schemaElements.string(),
		}),
	);
});

([
	["any", schemaElements.any],
	["string", schemaElements.string],
	["number", schemaElements.number],
	["boolean", schemaElements.boolean],
	["undefined", schemaElements.undefined],
	["null", schemaElements.null],
] as const).forEach(([name, value]) => {
	Deno.test(`schema serializer should handle primitive type '${name}'`, () => {
		const code = `
            interface Type {
                value: ${name};
            }
        `;

		const serializer = createSchemaSerializer({ code });
		assertEquals(
			serializer.serialize("Type"),
			schemaElements.object({
				value: value(),
			}),
		);
	});
});

Deno.test("schema serializer should handle literal type", () => {
	const code = `
        interface Type {
            value: "hello";
        }
    `;

	const serializer = createSchemaSerializer({ code });
	assertEquals(
		serializer.serialize("Type"),
		schemaElements.object({
			value: schemaElements.literal("hello"),
		}),
	);
});

Deno.test("schema serializer should handle optional type", () => {
	const code = `
        interface Type {
            value?: string;
        }
    `;

	const serializer = createSchemaSerializer({ code });
	assertEquals(
		serializer.serialize("Type"),
		schemaElements.object({
			value: schemaElements.optional(schemaElements.string()),
		}),
	);
});

Deno.test("schema serializer should handle array ([]) type", () => {
	const code = `
        interface Type {
            value: string[];
        }
    `;

	const serializer = createSchemaSerializer({ code });
	assertEquals(
		serializer.serialize("Type"),
		schemaElements.object({
			value: schemaElements.array(schemaElements.string()),
		}),
	);
});

Deno.test("schema serializer should handle array (Array) type", () => {
	const code = `
        interface Type {
            value: Array<string>;
        }
    `;

	const serializer = createSchemaSerializer({ code });
	assertEquals(
		serializer.serialize("Type"),
		schemaElements.object({
			value: schemaElements.array(schemaElements.string()),
		}),
	);
});

Deno.test("schema serializer should handle tuple type", () => {
	const code = `
		interface Type {
			value: [string, number];
		}
	`;

	const serializer = createSchemaSerializer({ code });
	assertEquals(
		serializer.serialize("Type"),
		schemaElements.object({
			value: schemaElements.tuple([
				schemaElements.string(),
				schemaElements.number(),
			]),
		}),
	);
});

Deno.test("schema serializer should handle never type", () => {
	const code = `
		interface Type {
			value: string & number;
		}
	`;

	const serializer = createSchemaSerializer({ code });
	assertEquals(
		serializer.serialize("Type"),
		schemaElements.object({
			value: schemaElements.never(),
		}),
	);
});

Deno.test("schema serializer should handle intersection type", () => {
	const code = `
		interface _TypeA {
			valueA: string;
		}
		interface _TypeB {
			valueB: number;
		}
		interface Type {
			value: _TypeA & _TypeB;
		}
	`;

	const serializer = createSchemaSerializer({ code });
	assertEquals(
		serializer.serialize("Type"),
		schemaElements.object({
			value: schemaElements.intersection(
				schemaElements.object({
					valueA: schemaElements.string(),
				}),
				schemaElements.object({
					valueB: schemaElements.number(),
				}),
			),
		}),
	);
});

Deno.test("schema serializer should handle union type", () => {
	const code = `
		interface Type {
			value: string | number;
		}
	`;

	const serializer = createSchemaSerializer({ code });
	assertEquals(
		serializer.serialize("Type"),
		schemaElements.object({
			value: schemaElements.union([
				schemaElements.string(),
				schemaElements.number(),
			]),
		}),
	);
});

Deno.test("schema serializer should handle nullable type", () => {
	const code = `
		interface Type {
			value: string | null;
		}
	`;

	const serializer = createSchemaSerializer({ code });
	assertEquals(
		serializer.serialize("Type"),
		schemaElements.object({
			value: schemaElements.nullable(schemaElements.string()),
		}),
	);
});

Deno.test("schema serializer should handle object type", () => {
	const code = `
		interface Type {
			value: { a: string; b: number };
		}
	`;

	const serializer = createSchemaSerializer({ code });
	assertEquals(
		serializer.serialize("Type"),
		schemaElements.object({
			value: schemaElements.object({
				a: schemaElements.string(),
				b: schemaElements.number(),
			}),
		}),
	);
});

// FIXME
// Deno.test("schema serializer should handle recursive type", () => {
// 	const code = `
// 		interface Type {
// 			value: Type;
// 		}
// 	`;

// 	const serializer = createSchemaSerializer({ code });
// 	assertEquals(
// 		serializer.serialize("Type"),
// 		schemaElements.object({
// 			value: schemaElements.unknown(),
// 		}),
// 	);
// });

Deno.test("schema serializer should handle type alias", () => {
	const code = `
		type TypeA = string;
		interface Type {
			value: TypeA;
		}
	`;

	const serializer = createSchemaSerializer({ code });
	assertEquals(
		serializer.serialize("Type"),
		schemaElements.object({
			value: schemaElements.string(),
		}),
	);
});

Deno.test("schema serializer should handle type alias with union type", () => {
	const code = `
		type TypeA = string | number;
		interface Type {
			value: TypeA;
		}
	`;

	const serializer = createSchemaSerializer({ code });
	assertEquals(
		serializer.serialize("Type"),
		schemaElements.object({
			value: schemaElements.union([
				schemaElements.string(),
				schemaElements.number(),
			]),
		}),
	);
});

Deno.test("schema serializer should handle class type", () => {
	const code = `
		class TypeA {
			value: string;
		}
		interface Type {
			value: TypeA;
		}
	`;

	const serializer = createSchemaSerializer({ code });
	assertEquals(
		serializer.serialize("Type"),
		schemaElements.object({
			value: schemaElements.object({
				value: schemaElements.string(),
			}),
		}),
	);
});

Deno.test("schema serializer should handle Record type", () => {
	const code = `
		interface Type {
			value: Record<string, string>;
		}
	`;

	const serializer = createSchemaSerializer({ code });
	assertEquals(
		serializer.serialize("Type"),
		schemaElements.object({
			value: schemaElements.record(schemaElements.string()),
		}),
	);
});

Deno.test("schema serializer should handle Pick type (with single key) ", () => {
	const code = `
		interface Type {
			value: Pick<{ a: string; b: number }, "a">;
		}
	`;

	const serializer = createSchemaSerializer({ code });
	assertEquals(
		serializer.serialize("Type"),
		schemaElements.object({
			value: schemaElements.object({
				a: schemaElements.string(),
			}),
		}),
	);
});

Deno.test("schema serializer should handle Pick type (with multiple keys)", () => {
	const code = `
		interface Type {
			value: Pick<{ a: string; b: number, c: Date }, "a" | "b">;
		}
	`;

	const serializer = createSchemaSerializer({ code });
	assertEquals(
		serializer.serialize("Type"),
		schemaElements.object({
			value: schemaElements.object({
				a: schemaElements.string(),
				b: schemaElements.number(),
			}),
		}),
	);
});

Deno.test("schema serializer should handle Pick type (with external type for keys)", () => {
	const code = `
		type _Keys = "a" | "b";
		interface Type {
			value: Pick<{ a: string; b: number, c: Date }, _Keys>;
		}
	`;

	const serializer = createSchemaSerializer({ code });
	assertEquals(
		serializer.serialize("Type"),
		schemaElements.object({
			value: schemaElements.object({
				a: schemaElements.string(),
				b: schemaElements.number(),
			}),
		}),
	);
});

Deno.test("schema serializer should handle Pick type (with external type for keys and external type)", () => {
	const code = `
		type _Keys = "a" | "b";
		type _Type = { a: string; b: number, c: Date };
		interface Type {
			value: Pick<_Type, _Keys>;
		}
	`;

	const serializer = createSchemaSerializer({ code });
	assertEquals(
		serializer.serialize("Type"),
		schemaElements.object({
			value: schemaElements.object({
				a: schemaElements.string(),
				b: schemaElements.number(),
			}),
		}),
	);
});

Deno.test("schema serializer should handle inheritance with type alias (Pick)", () => {
	const code = `
        interface _SubType {
            propB: string;
			propC: number;
        }
        interface Type extends Pick<_SubType, "propB"> {
            propA: string;
        }
    `;

	const serializer = createSchemaSerializer({ code });
	assertEquals(
		serializer.serialize("Type"),
		schemaElements.object({
			propA: schemaElements.string(),
			propB: schemaElements.string(),
		}),
	);
});

Deno.test("schema serializer should handle inheritance with type alias (Omit)", () => {
	const code = `
        interface _SubType {
            propB: string;
			propC: number;
        }
        interface Type extends Omit<_SubType, "propC"> {
            propA: string;
        }
    `;

	const serializer = createSchemaSerializer({ code });
	assertEquals(
		serializer.serialize("Type"),
		schemaElements.object({
			propA: schemaElements.string(),
			propB: schemaElements.string(),
		}),
	);
});

Deno.test("schema serializer should handle type alias Pick", () => {
	const code = `
        interface _SubType {
            propA: string;
			propB: number;
        }
        type Type = Pick<_SubType, "propA">
    `;

	const serializer = createSchemaSerializer({ code });
	assertEquals(
		serializer.serialize("Type"),
		schemaElements.object({
			propA: schemaElements.string(),
		}),
	);
});

Deno.test("schema serializer should handle Date type", () => {
	const code = `
        interface Type {
			propA: Date;
		}
    `;

	const serializer = createSchemaSerializer({ code });
	assertEquals(
		serializer.serialize("Type"),
		schemaElements.object({
			propA: schemaElements.date(),
		}),
	);
});
