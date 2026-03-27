export interface SanitizedAbcResult {
	text: string;
	warnings: string[];
}

export class AbcSecurityError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AbcSecurityError";
	}
}

const MAX_ABC_INPUT_CHARS = 50000;
const MAX_ABC_LINES = 2000;
const MAX_ABC_LINE_CHARS = 500;
const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const looksLikeHtml = (text: string): boolean => /<\s*\/?\s*[a-zA-Z!]/.test(text);

const normalizeLineEndings = (text: string): string => text.replace(/\r\n?/g, "\n");

export const sanitizeAbcInput = (rawText: string): SanitizedAbcResult => {
	if (rawText.length > MAX_ABC_INPUT_CHARS) {
		throw new AbcSecurityError(`入力が長すぎます。${MAX_ABC_INPUT_CHARS.toLocaleString()}文字以下にしてください。`);
	}

	const warnings: string[] = [];
	let sanitized = normalizeLineEndings(rawText);

	if (CONTROL_CHAR_REGEX.test(sanitized)) {
		sanitized = sanitized.replace(CONTROL_CHAR_REGEX, "");
		warnings.push("制御文字を除去しました。");
	}

	if (looksLikeHtml(sanitized)) {
		throw new AbcSecurityError("HTMLのような入力は許可されていません。");
	}

	const lines = sanitized.split("\n");
	if (lines.length > MAX_ABC_LINES) {
		throw new AbcSecurityError(`行数が多すぎます。${MAX_ABC_LINES.toLocaleString()}行以下にしてください。`);
	}

	const hasTooLongLine = lines.some((line) => line.length > MAX_ABC_LINE_CHARS);
	if (hasTooLongLine) {
		throw new AbcSecurityError(`1行が長すぎます。${MAX_ABC_LINE_CHARS.toLocaleString()}文字以下で入力してください。`);
	}

	return {
		text: sanitized,
		warnings,
	};
};
