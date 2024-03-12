import { Casing, printableAsciiRegex, regexes } from "./defs.ts";
import { IdentifierError } from "./errors.ts";

export function validateIdentifier(
	ident: string,
	identType: Casing,
) {
	if (ident.length < 1 || ident.length > 32) {
		throw new IdentifierError("must be between 1 and 32 characters", ident);
	}

	if (!printableAsciiRegex.test(ident)) {
		throw new IdentifierError("must contain only printable ASCII characters", ident);
	}

	const regex = regexes[identType];
	if (!regex.test(ident)) {
		throw new IdentifierError(`must be ${identType} (match the pattern ${regex})`, ident);
	}

	return null;
}
