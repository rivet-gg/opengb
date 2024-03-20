import { InternalError } from "../../error/mod.ts";
import { ts, zod, zodOpenApi } from "../deps.ts";

// zodOpenApi.extendZodWithOpenApi(zod);

const js = String.raw;

type SchemaElementType =
	| "unknown"
	| "optional"
	| "date"
	| "string"
	| "number"
	| "boolean"
	| "undefined"
	| "null"
	| "any"
	| "literal"
	| "tuple"
	| "array"
	| "intersection"
	| "union"
	| "nullable"
	| "never"
	| "record"
	| "object";

export type AnySchemaElement =
	| {
		type: SchemaElementType;
	}
	| { type: "literal"; value: AnySchemaElement }
	| { type: "optional"; value: AnySchemaElement }
	| { type: "tuple"; items: AnySchemaElement[] }
	| { type: "array"; items: AnySchemaElement }
	| { type: "intersection"; left: AnySchemaElement; right: AnySchemaElement }
	| { type: "union"; items: AnySchemaElement[] }
	| { type: "nullable"; item: AnySchemaElement }
	| { type: "object"; properties: Record<string, AnySchemaElement> };

export const schemaElements = {
	unknown: () => ({ type: "unknown" }),
	optional: (value: AnySchemaElement) => ({ type: "optional", value }),
	date: () => ({ type: "date" }),
	string: () => ({ type: "string" }),
	number: () => ({ type: "number" }),
	boolean: () => ({ type: "boolean" }),
	undefined: () => ({ type: "undefined" }),
	null: () => ({ type: "null" }),
	any: () => ({ type: "any" }),
	never: () => ({ type: "never" }),
	literal: (value: string | number | undefined) => ({
		type: "literal",
		value,
	}),
	tuple: (items: AnySchemaElement[]) => ({ type: "tuple", items }),
	array: (item: AnySchemaElement) => ({ type: "array", item }),
	intersection: (left: AnySchemaElement, right: AnySchemaElement) => ({
		type: "intersection",
		left,
		right,
	}),
	union: (items: AnySchemaElement[]) => ({ type: "union", items }),
	nullable: (item: AnySchemaElement) => ({ type: "nullable", item }),
	object: (properties: Record<string, AnySchemaElement>) => ({
		type: "object",
		properties,
	}),
	record: (elementType: AnySchemaElement) => ({
		type: "record",
		elementType,
	}),
} satisfies Record<SchemaElementType, (...args: any[]) => AnySchemaElement>;

type SchemaElementsMap = typeof schemaElements;
const s = schemaElements;

function is<Type extends keyof SchemaElementsMap = keyof SchemaElementsMap>(
	type: Type,
	value: AnySchemaElement,
): value is ReturnType<SchemaElementsMap[Type]> {
	return value.type === type;
}

const generateSerializableTypeSchema = (
	type: ts.Type<any>,
	modifiers: { isOptional?: boolean } = {},
): AnySchemaElement => {
	const symbol = type.getSymbol();
	const symbolDeclartion = symbol?.getDeclarations()[0];
	// modifiers come first
	if (modifiers.isOptional) {
		return s.optional(
			generateSerializableTypeSchema(type.getNonNullableType()),
		);
	}
	if (type.isNullable()) {
		return s.nullable(
			generateSerializableTypeSchema(type.getNonNullableType()),
		);
	}
	// primitives first
	if (type.isUndefined()) {
		return s.undefined();
	}
	if (type.isBoolean()) {
		return s.boolean();
	}
	if (type.isUnion()) {
		const types = type.getUnionTypes().map((child) =>
			generateSerializableTypeSchema(child)
		);
		return s.union(types);
	}
	if (type.isNumber()) {
		return s.number();
	}
	if (type.isString()) {
		return s.string();
	}
	if (type.isAny()) {
		return s.any();
	}
	if (type.isNull()) {
		return s.null();
	}
	if (type.isNever()) {
		return s.never();
	}
	if (type.isIntersection()) {
		const types = type.getIntersectionTypes().map((child) =>
			generateSerializableTypeSchema(child)
		);
		// TODO: Support multiple intersection
		return s.intersection(types[0], types[1]);
	}
	if (type.isArray()) {
		return s.array(generateSerializableTypeSchema(type.getArrayElementType()!));
	}
	if (type.isTuple()) {
		const elements = type.getTupleElements().map((child) =>
			generateSerializableTypeSchema(child)
		);
		return s.tuple(elements);
	}
	if (
		type.isStringLiteral() || type.isNumberLiteral() || type.isBooleanLiteral()
	) {
		return s.literal(type.getLiteralValue() as string | number | undefined);
	}

	if (
		type.isInterface() || type.isClass() ||
		ts.Node.isTypeLiteral(symbolDeclartion)
	) {
		const propertiesMap = type.getProperties().map((
			prop,
		) => {
			const propType = prop.getValueDeclaration()?.getFirstChild((node) =>
				ts.Node.isTypeNode(node)
			)?.getType() ?? prop.getValueDeclaration()?.getType();
			return [
				prop.getName(),
				propType
					? generateSerializableTypeSchema(propType, {
						isOptional: prop.isOptional(),
					})
					: s.unknown(),
			];
		});

		return s.object(Object.fromEntries(propertiesMap));
	}

	return s.unknown();
};

const convertSchemaToRawZod = (schema: AnySchemaElement): string => {
	if (is("unknown", schema)) {
		return js`z.unknown()`;
	}
	if (is("optional", schema)) {
		return js`z.optional(${convertSchemaToRawZod(schema.value)})`;
	}
	if (is("date", schema)) {
		return js`z.date()`;
	}
	if (is("string", schema)) {
		return js`z.string()`;
	}
	if (is("number", schema)) {
		return js`z.number()`;
	}
	if (is("boolean", schema)) {
		return js`z.boolean()`;
	}
	if (is("undefined", schema)) {
		return js`z.undefined()`;
	}
	if (is("null", schema)) {
		return js`z.null()`;
	}
	if (is("any", schema)) {
		return js`z.any()`;
	}
	if (is("literal", schema)) {
		const value = typeof schema.value === "string"
			? `"${schema.value}"`
			: schema.value;
		return js`z.literal(${value})`;
	}
	if (is("tuple", schema)) {
		return js`z.tuple([${schema.items.map(convertSchemaToRawZod).join(", ")}])`;
	}
	if (is("array", schema)) {
		return js`z.array(${convertSchemaToRawZod(schema.item)})`;
	}
	if (is("intersection", schema)) {
		const { left, right } = schema;
		return js`z.intersection(${
			[convertSchemaToRawZod(left), convertSchemaToRawZod(right)].join(", ")
		})`;
	}
	if (is("union", schema)) {
		return js`z.union([${schema.items.map(convertSchemaToRawZod).join(", ")}])`;
	}
	if (is("nullable", schema)) {
		return js`z.nullable(${convertSchemaToRawZod(schema.item)})`;
	}
	if (is("object", schema)) {
		return js`z.object({${
			Object.entries(schema.properties).map(([name, type]) =>
				js`${name}: ${convertSchemaToRawZod(type)}`
			).join(", ")
		}})`;
	}
	if (is("record", schema)) {
		return js`z.record(${convertSchemaToRawZod(schema.elementType)})`;
	}

	return js`z.unknown()`;
};

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
		return zod.tuple([schemaA, schemaB, ...schemas]);
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
		return zod.union([schemaA, schemaB, ...schemas]);
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
		);
	}
	if (is("record", schema)) {
		return zod.record(convertSchemaToZod(schema.elementType));
	}

	return zod.unknown();
};

const generateSerializableTypeNodeSchema = (
	typeNode: ts.TypeNode,
	modifiers: { isOptional?: boolean } = {},
): AnySchemaElement => {
	if (modifiers.isOptional) {
		return s.optional(generateSerializableTypeNodeSchema(typeNode));
	}
	if (ts.Node.isTypeReference(typeNode)) {
		const typeName = typeNode.getTypeName();
		const name = typeName.getText();

		const builtInType = resolveBuiltInType(name, typeNode.getTypeArguments());
		if (builtInType) {
			return builtInType;
		}

		if (ts.Node.isIdentifier(typeName)) {
			const declaration = typeName.getSymbol()?.getDeclarations()[0];
			if (
				ts.Node.isInterfaceDeclaration(declaration) ||
				ts.Node.isTypeAliasDeclaration(declaration) ||
				ts.Node.isClassDeclaration(declaration)
			) {
				return generateSerializableDeclarationSchema(declaration);
			}
			return s.unknown();
		}

		return s.unknown();
	}

	if (ts.Node.isExpressionWithTypeArguments(typeNode)) {
		const name = typeNode.getExpression().getText();
		const builtInType = resolveBuiltInType(name, typeNode.getTypeArguments());
		if (builtInType) {
			return builtInType;
		}
		return generateSerializableTypeSchema(typeNode.getType());
	}
	return generateSerializableTypeSchema(typeNode.getType());
};

const resolveBuiltInType = (
	name: string,
	typeArguments: ts.TypeNode<any>[],
) => {
	if (name === "Record") {
		const [, valueType] = typeArguments;
		return s.record(generateSerializableTypeNodeSchema(valueType));
	}

	if (name === "Pick") {
		const [sourceType, keysType] = typeArguments;
		const sourceSchema = generateSerializableTypeNodeSchema(sourceType);
		if (is("object", sourceSchema)) {
			const keysTypeSchema = generateSerializableTypeNodeSchema(keysType);
			let keys: string[] = [];
			if (is("union", keysTypeSchema)) {
				keys = keysTypeSchema.items.map((key) => {
					if (is("literal", key)) {
						return key.value as string;
					}
				}).filter(Boolean) as string[];
			} else if (is("literal", keysTypeSchema)) {
				keys = [keysTypeSchema.value as string];
			}
			return s.object(Object.fromEntries(
				Object.keys(sourceSchema.properties).filter((key) => keys.includes(key))
					.map((
						key,
					) => [key, sourceSchema.properties[key]]),
			));
		}
		return s.unknown();
	}

	if (name === "Omit") {
		const [sourceType, keysType] = typeArguments;
		const sourceSchema = generateSerializableTypeNodeSchema(sourceType);
		if (is("object", sourceSchema)) {
			const keysTypeSchema = generateSerializableTypeNodeSchema(keysType);
			let keys: string[] = [];
			if (is("union", keysTypeSchema)) {
				keys = keysTypeSchema.items.map((key) => {
					if (is("literal", key)) {
						return key.value as string;
					}
				}).filter(Boolean) as string[];
			} else if (is("literal", keysTypeSchema)) {
				keys = [keysTypeSchema.value as string];
			}
			return s.object(Object.fromEntries(
				Object.keys(sourceSchema.properties).filter((key) =>
					!keys.includes(key)
				)
					.map((
						key,
					) => [key, sourceSchema.properties[key]]),
			));
		}
		return s.unknown();
	}

	if (name === "Array") {
		const [arrayType] = typeArguments;
		return s.array(generateSerializableTypeNodeSchema(arrayType));
	}

	if (name === "Date") {
		return s.date();
	}
};

const generateSerializableDeclarationSchema = (
	declaration:
		| ts.InterfaceDeclaration
		| ts.TypeAliasDeclaration
		| ts.ClassDeclaration,
): AnySchemaElement => {
	if (
		ts.Node.isInterfaceDeclaration(declaration) ||
		ts.Node.isClassDeclaration(declaration)
	) {
		const heriatageClauses = declaration.getHeritageClauses();
		const heriatageClausesSchemas = heriatageClauses.map((clause) => {
			return clause.getTypeNodes().map((typeNode) => {
				return generateSerializableTypeNodeSchema(typeNode);
			});
		}).flat();

		const props = declaration.getProperties().map((prop) => {
			return [
				prop.getName(),
				generateSerializableTypeNodeSchema(prop.getTypeNode()!, {
					isOptional: prop.hasQuestionToken(),
				}),
			];
		});

		return s.object({
			...Object.fromEntries(props),
			...heriatageClausesSchemas.reduce((acc, schema) => {
				if (is("object", schema)) {
					return {
						...acc,
						...schema.properties,
					};
				}
				return acc;
			}, {}),
		});
	}
	if (ts.Node.isTypeAliasDeclaration(declaration)) {
		const typeNode = declaration.getTypeNode();
		if (!typeNode) {
			return s.unknown();
		}
		return generateSerializableTypeNodeSchema(typeNode);
	}

	return s.unknown();
};

const DEFAULT_COMPILER_OPTIONS = {
	allowJs: true,
	esModuleInterop: true,
	experimentalDecorators: false,
	inlineSourceMap: true,
	isolatedModules: true,
	jsx: ts.JsxEmit.React,
	module: ts.ModuleKind.ESNext,
	moduleDetection: ts.ModuleDetectionKind.Force,
	strict: true,
	target: ts.ScriptTarget.ESNext,
	useDefineForClassFields: true,

	// lib: ["esnext", "dom", "dom.iterable"],
	allowImportingTsExtensions: true,
};

export const createSchemaSerializer = (
	opts: { path: string } | { code: string },
) => {
	const hasCode = "code" in opts;
	const project = new ts.Project({
		compilerOptions: hasCode
			? { target: ts.ScriptTarget.ESNext, strict: true }
			: DEFAULT_COMPILER_OPTIONS,
		skipAddingFilesFromTsConfig: hasCode,
		useInMemoryFileSystem: hasCode,
	});

	const sourceFile = "path" in opts
		? project.addSourceFileAtPath(opts.path)
		: project.createSourceFile("mod.ts", opts.code);

	// project.resolveSourceFileDependencies();

	const path = "path" in opts ? opts.path : "mod.ts";

	return {
		serialize: (interfaceName: string) => {
			const typeDeclaration = sourceFile.getInterface(interfaceName) ||
				sourceFile.getTypeAlias(interfaceName);

			if (!typeDeclaration) {
				throw new InternalError(
					`No ${interfaceName} definition found in ${path}`,
					{
						path,
					},
				);
			}

			return generateSerializableDeclarationSchema(typeDeclaration);
		},
	};
};

export const convertSerializedSchemaToZod = (
	serializedSchema: AnySchemaElement,
) => {
	return convertSchemaToZod(serializedSchema);
};
export const convertSerializedSchemaToRawZod = (
	serializedSchema: AnySchemaElement,
) => {
	return convertSchemaToRawZod(serializedSchema);
};
