import { describe, expect, it } from "vitest";

import { AbcSecurityError, sanitizeAbcInput } from "../src/abcInputSecurity.ts";

describe("abcInputSecurity", () => {
	it("制御文字を除去できる", () => {
		const result = sanitizeAbcInput("X:1\nT:test\u0000\nK:C");

		expect(result.text).toContain("T:test");
		expect(result.text).not.toContain("\u0000");
		expect(result.warnings.length).toBeGreaterThan(0);
	});

	it("HTMLのような入力を拒否する", () => {
		expect(() => sanitizeAbcInput("<script>alert(1)</script>"))
			.toThrow(AbcSecurityError);
	});

	it("ABCテキスト中にHTMLタグが混在している場合も拒否する", () => {
		const abcWithHtml = "X:1\nT:test\nK:C\na>b c<d\n<div>bad</div>";
		expect(() => sanitizeAbcInput(abcWithHtml)).toThrow(AbcSecurityError);
	});

	it("ABCのブロークン・リズム記法の<と>は許可する", () => {
		const abc = "L:1/8\na>b c<d abcd";
		const result = sanitizeAbcInput(abc);

		expect(result.text).toBe(abc);
		expect(result.warnings).toHaveLength(0);
	});

	it("ブロークン・リズム記法が複数行にあっても許可する", () => {
		const abc = "X:1\nL:1/8\nK:C\na>b c<d\ne<f g>a";
		const result = sanitizeAbcInput(abc);

		expect(result.text).toBe(abc);
		expect(result.warnings).toHaveLength(0);
	});

	it("入力サイズ上限を超えたら拒否する", () => {
		const tooLong = "A".repeat(50001);
		expect(() => sanitizeAbcInput(tooLong)).toThrow(AbcSecurityError);
	});
});
