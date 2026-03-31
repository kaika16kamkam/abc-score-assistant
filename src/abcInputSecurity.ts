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

// Public web向け: 入力サイズを制限して過負荷や異常入力を抑止する。
const MAX_ABC_INPUT_CHARS = 50000;
const MAX_ABC_LINES = 2000;
const MAX_ABC_LINE_CHARS = 500;
const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const HTML_PAIRED_TAG_REGEX = /<\s*([a-zA-Z][a-zA-Z0-9:-]*)\b[^<>]*>[\s\S]*<\s*\/\s*\1\s*>/i;
const HTML_DANGEROUS_SINGLE_TAG_REGEX = /<\s*(script|style|iframe|svg|math|object|embed|link|meta|img|base|form|input|button|textarea|select|video|audio)\b[^<>]*\/?>/i;
const HTML_SPECIAL_NODE_REGEX = /<!--(?:[\s\S]*?)-->|<!DOCTYPE(?:[\s\S]*?)>/i;

const looksLikeHtml = (text: string): boolean => (
	HTML_PAIRED_TAG_REGEX.test(text)
	|| HTML_DANGEROUS_SINGLE_TAG_REGEX.test(text)
	|| HTML_SPECIAL_NODE_REGEX.test(text)
);

const normalizeLineEndings = (text: string): string => text.replace(/\r\n?/g, "\n");

/**
 * ABC入力文字列を公開サイト向けに最小サニタイズする。
 * - 制御文字の除去
 * - サイズ/行数/1行長の制限
 * - HTMLライクな文字列の拒否
 */
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
