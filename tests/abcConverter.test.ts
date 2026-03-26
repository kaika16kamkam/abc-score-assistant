import { describe, expect, it } from "vitest";

import { convertTrackToAbc, generateAbcHeader, getNoteName } from "../src/abcConverter.ts";
import type { MidiNote, TimeSignature } from "../src/type.ts";

describe("abcConverter", () => {
    it("MIDIノート番号をABC音名に変換できる", () => {
        expect(getNoteName(60)).toBe("C");
        expect(getNoteName(72)).toBe("c");
    });

    it("ファイル名からABCヘッダーを生成できる", () => {
        const header = generateAbcHeader("valid_basic.mid");

        expect(header).toContain("T:valid_basic");
        expect(header).toContain("X:1");
        expect(header).toContain("M:4/4");
        expect(header).toContain("K:C");
    });

    it("ノート列をABC文字列へ変換できる", () => {
        const mockNotes: MidiNote[] = [
            { tick: 0, note: 60 },
            { tick: 480, note: 62 },
            { tick: 720, note: 64 },
        ];

        const result = convertTrackToAbc(mockNotes, 480);

        expect(result).toContain("C2");
        expect(result).toContain("D ");
        expect(result).toContain("E2");
    });

    it("音の前の空白を休符として出力できる", () => {
        const mockNotes: MidiNote[] = [{ tick: 480, note: 60 }];

        const result = convertTrackToAbc(mockNotes, 480);

        expect(result).toContain("z2 C2");
    });

    it("拍子に応じて小節線を挿入できる", () => {
        const notesIn44: MidiNote[] = [
            { tick: 0, note: 60 },
            { tick: 480, note: 62 },
            { tick: 960, note: 64 },
            { tick: 1440, note: 65 },
        ];
        const notesIn34: MidiNote[] = [
            { tick: 0, note: 60 },
            { tick: 480, note: 62 },
            { tick: 960, note: 64 },
        ];
        const timeSig34: TimeSignature = { n: 3, d: 4 };

        expect(convertTrackToAbc(notesIn44, 480)).toContain("|");
        expect(convertTrackToAbc(notesIn34, 480, timeSig34)).toContain("|");
    });

    it("同tickの複数ノートを和音記法で出力できる", () => {
        const chordNotes: MidiNote[] = [
            { tick: 0, note: 60 },
            { tick: 0, note: 64 },
            { tick: 0, note: 67 },
            { tick: 480, note: 60 },
        ];

        const result = convertTrackToAbc(chordNotes, 480);

        expect(result).toContain("[CEG]2");
    });

    it("小節をまたぐノートはタイで分割される", () => {
        const notesCrossBar: MidiNote[] = [
            { tick: 1440, note: 60 },
            { tick: 2400, note: 62 },
        ];

        const result = convertTrackToAbc(notesCrossBar, 480);

        expect(result).toMatch(/C2-\s+\|\s+C2/);
    });

    it("休符も小節境界で分割される", () => {
        const notesAfterLongRest: MidiNote[] = [
            { tick: 2400, note: 60 },
        ];

        const result = convertTrackToAbc(notesAfterLongRest, 480);

        expect(result).toMatch(/z8\s+\|\s+z2\s+C2/);
    });

    it("シャープ後に同音名へ戻るとナチュラルを出力する", () => {
        const notes: MidiNote[] = [
            { tick: 0, note: 61 },
            { tick: 480, note: 60 },
        ];

        const result = convertTrackToAbc(notes, 480);

        expect(result).toContain("^C2");
        expect(result).toContain("=C2");
    });
});
