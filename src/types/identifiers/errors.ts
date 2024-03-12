import { UserError, UserErrorOpts } from "../../error/mod.ts";
import { printableAsciiRegex } from "./defs.ts";
import { bold, brightRed } from "./deps.ts";

export class IdentifierError extends UserError {
	public constructor(private issue: string, private identifier: string, opts?: UserErrorOpts) {
		super(`"${debugIdentifier(identifier)}": ${issue}`, opts);

		this.name = "IdentifierError";
	}

	public toString(identifierType = "identifier") {
		const highlightedIdentifier = brightRed(bold(debugIdentifier(this.identifier)));
		return `invalid ${identifierType} ${highlightedIdentifier}: ${this.issue}`;
	}
}

/**
 * Converts an identifier into a string that can be printed to the console.
 *
 * This function should be used when working with unverified
 * module/script/error names, as it is guaranteed it won't mess up the
 * terminal or obscure logging with control characters.
 *
 * Examples:
 * ```ts
 * IdentError.debugIdentifier("hello") // "hello"
 * IdentError.debugIdentifier("hello\x20world") // "hello world"
 * IdentError.debugIdentifier("hello\x7fworld") // "hello\7fworld"
 * IdentError.debugIdentifier("hello_wòrld") // "hello_w\xf2rld"
 *
 * @param ident The identifier to be converted into a safe debugged string
 * @returns A string containing all string-safe printable ascii characters, with
 * non-printable characters escaped as hex or unicode.
 */
function debugIdentifier(ident: string): string {
	const lenLimited = ident.length > 32 ? ident.slice(0, 32) + "..." : ident;
	const characters = lenLimited.split("");

	let output = "";
	for (const char of characters) {
		// If the character is printable without any special meaning, just
		// add it.
		if (printableAsciiRegex.test(char) && char !== "\\" && char !== '"') {
			output += char;
			continue;
		}

		// Escape `\` and `"` characters to reduce ambiguity
		if (char === "\\") {
			output += "\\\\";
			continue;
		} else if (char === '"') {
			output += '\\"';
			continue;
		}

		// Escape non-printable characters
		const charCode = char.charCodeAt(0);
		if (charCode > 255) { // 16-bit unicode escape
			output += `\\u${charCode.toString(16).padStart(4, "0")}`;
		} else { // 8-bit ascii/extended-ascii escape
			output += `\\x${charCode.toString(16).padStart(2, "0")}`;
		}
	}
	return `"${output}"`;
}
