import { InternalError } from "../../error/mod.ts";
import { ClassDeclaration, InterfaceDeclaration, Node, Project, ts, Type, TypeAliasDeclaration, z } from "./deps.ts";
import { AnySchemaElement, is, s, SchemaElementOptions } from "./schema.ts";

const OPENGB_SCHEMA_TYPESCRIPT_LIB_FILE = "__OPENGB_INTERNALS___THIS_FILE_IS_NOT_REAL__internal_types.d.ts";

function generateSerializableTypeSchema(
	type: Type<any>,
	modifiers: { isOptional?: boolean } = {},
): AnySchemaElement {
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

	// built in types, check if it's a built in type (comes with our internal types)
	if (
		symbolDeclartion?.getSourceFile().getFilePath().includes(OPENGB_SCHEMA_TYPESCRIPT_LIB_FILE)
	) {
		if (type.getText() === "Date") {
			// don't serialize Date from typescript
			return s.date();
		}
	}

	// primitives first
	if (type.isUndefined()) {
		return s.undefined();
	}
	if (type.isBoolean()) {
		return s.boolean();
	}
	if (type.isUnion()) {
		const types = type.getUnionTypes().map((child) => generateSerializableTypeSchema(child));
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
		const types = type.getIntersectionTypes().map((child) => generateSerializableTypeSchema(child));
		// TODO: Support multiple intersection
		return s.intersection(types[0]!, types[1]!);
	}
	if (type.isArray()) {
		return s.array(generateSerializableTypeSchema(type.getArrayElementType()!));
	}
	if (type.isTuple()) {
		const elements = type.getTupleElements().map((child) => generateSerializableTypeSchema(child));
		return s.tuple(elements);
	}
	if (
		type.isStringLiteral() || type.isNumberLiteral() || type.isBooleanLiteral()
	) {
		return s.literal(type.getLiteralValue() as string | number | undefined);
	}

	if (
		type.isInterface() || type.isClass() ||
		Node.isTypeLiteral(symbolDeclartion)
	) {
		const propertiesMap = type.getProperties().map((
			prop,
		) => {
			const type = prop.getValueDeclaration()?.getType() || prop.getTypeAtLocation(prop.getDeclarations()[0]!);
			return [
				prop.getName(),
				generateSerializableTypeSchema(type, { isOptional: prop.isOptional() }),
			];
		});

		return s.object(Object.fromEntries(propertiesMap));
	}

	if (type.isObject()) {
		const stringIndexType = type.getStringIndexType();
		if (stringIndexType) {
			const indexType = generateSerializableTypeSchema(stringIndexType);
			return s.record(indexType);
		}
		const numberIndexType = type.getNumberIndexType();
		if (numberIndexType) {
			const indexType = generateSerializableTypeSchema(numberIndexType);
			return s.record(indexType);
		}
		const properties = type.getProperties();
		const propMap = properties.map((prop) => {
			const type = prop.getValueDeclaration()?.getType() || prop.getTypeAtLocation(prop.getDeclarations()[0]!);
			return [
				prop.getName(),
				type ? generateSerializableTypeSchema(type) : s.unknown(),
			];
		});
		return s.object(Object.fromEntries(propMap));
	}

	return s.unknown();
}

const DEFAULT_COMPILER_OPTIONS = {
	allowJs: true,
	esModuleInterop: true,
	experimentalDecorators: false,
	isolatedModules: true,
	strict: true,
	useDefineForClassFields: true,
	noLib: true,
	allowImportingTsExtensions: true,
};

function generateSerializableDeclarationSchema(
	declaration:
		| InterfaceDeclaration
		| TypeAliasDeclaration
		| ClassDeclaration,
): AnySchemaElement {
	if (
		Node.isInterfaceDeclaration(declaration) ||
		Node.isClassDeclaration(declaration)
	) {
		const heriatageClauses = declaration.getHeritageClauses();
		const heriatageClausesSchemas = heriatageClauses.map((clause) => {
			return clause.getTypeNodes().map((typeNode) => {
				return generateSerializableTypeSchema(typeNode.getType()!);
			});
		}).flat();

		const props = declaration.getProperties().map((prop) => {
			return [
				prop.getName(),
				generateSerializableTypeSchema(prop.getType()!, {
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
	if (Node.isTypeAliasDeclaration(declaration)) {
		const type = declaration.getType();
		return generateSerializableTypeSchema(type);
	}

	return s.unknown();
}

// This is a stripped down version of the typescript lib
// that only contains the types we want to serialize.
// This is to avoid serializing the entire typescript lib which
// is huge and contains a lot of types we don't need.
const tsLib = Deno.readTextFileSync(import.meta.dirname + "/schema_ts_lib.ts");

export function createSchemaSerializer(
	opts: { path: string } | { code: string },
) {
	const hasCode = "code" in opts;
	const project = new Project({
		compilerOptions: hasCode ? { target: ts.ScriptTarget.ESNext, strict: true, noLib: true } : DEFAULT_COMPILER_OPTIONS,
		skipAddingFilesFromTsConfig: hasCode,
		useInMemoryFileSystem: hasCode,
	});

	const sourceFile = "path" in opts
		? project.addSourceFileAtPath(opts.path)
		: project.createSourceFile("mod.ts", opts.code);

	project.createSourceFile(OPENGB_SCHEMA_TYPESCRIPT_LIB_FILE, tsLib);

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
}

function convertZodOptionsToSchemaOptions(schema: z.ZodTypeAny): SchemaElementOptions {
	if (schema._def.description) {
		return { description: schema._def.description };
	}
	return {};
}

export function convertZodToSerializedSchema(schema: z.ZodTypeAny): AnySchemaElement {
	const opts = convertZodOptionsToSchemaOptions(schema);

	if (schema instanceof z.ZodUnion) {
		const types = schema._def.options.map(convertZodToSerializedSchema);
		return s.union(types, opts);
	}

	if (schema instanceof z.ZodLiteral) {
		return s.literal(schema._def.value, opts);
	}

	if (schema instanceof z.ZodOptional) {
		return s.optional(convertZodToSerializedSchema(schema._def.innerType), opts);
	}

	if (schema instanceof z.ZodArray) {
		return s.array(convertZodToSerializedSchema(schema._def.type), opts);
	}

	if (schema instanceof z.ZodTuple) {
		const types = schema._def.items.map(convertZodToSerializedSchema);
		return s.tuple(types, opts);
	}

	if (schema instanceof z.ZodDate) {
		return s.date(opts);
	}

	if (schema instanceof z.ZodNumber) {
		return s.number(opts);
	}

	if (schema instanceof z.ZodString) {
		return s.string(opts);
	}

	if (schema instanceof z.ZodBoolean) {
		return s.boolean(opts);
	}

	if (schema instanceof z.ZodUndefined) {
		return s.undefined(opts);
	}

	if (schema instanceof z.ZodNull) {
		return s.null(opts);
	}

	if (schema instanceof z.ZodAny) {
		return s.any(opts);
	}

	if (schema instanceof z.ZodIntersection) {
		const left = convertZodToSerializedSchema(schema._def.left);
		const right = convertZodToSerializedSchema(schema._def.right);
		return s.intersection(left, right, opts);
	}

	if (schema instanceof z.ZodNullable) {
		return s.nullable(convertZodToSerializedSchema(schema._def.innerType), opts);
	}

	if (schema instanceof z.ZodRecord) {
		return s.record(convertZodToSerializedSchema(schema._def.valueType), opts);
	}

	if (schema instanceof z.ZodUnknown) {
		return s.unknown(opts);
	}

	if (schema instanceof z.ZodObject) {
		const properties: [string, AnySchemaElement][] = Array.from(Object.entries(schema._def.shape())).map(
			([name, type]) => {
				if (type instanceof z.ZodType) {
					return [name, convertZodToSerializedSchema(type)];
				}
				return [name, s.unknown(opts)];
			},
		);

		return s.object(Object.fromEntries(properties), opts);
	}

	if (schema instanceof z.ZodBoolean) {
		return s.boolean(opts);
	}

	if (schema instanceof z.ZodEnum) {
		return s.union(
			schema._def.values.map((type: unknown) => {
				if (typeof type === "string" || typeof type === "number") {
					return s.literal(type, opts);
				}
				return s.unknown(opts);
			}),
			opts,
		);
	}

	return s.unknown(opts);
}
