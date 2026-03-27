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

	it("入力サイズ上限を超えたら拒否する", () => {
		const tooLong = "A".repeat(50001);
		expect(() => sanitizeAbcInput(tooLong)).toThrow(AbcSecurityError);
	});
});
