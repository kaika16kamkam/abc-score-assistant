import { describe, expect, it } from "vitest";

import { analyzeTracks, extractTempo, extractTimeSignature } from "../src/midiUtils.ts";
import { parseMidiFixture } from "./helpers/parseMidiFixture.ts";

describe("midiUtils", () => {
    it("6by4.mid から拍子とテンポを抽出できる", () => {
        const midiData = parseMidiFixture("6by4.mid");

        const timeSig = extractTimeSignature(midiData);
        const bpm = extractTempo(midiData);

        expect(timeSig.n).toBe(6);
        expect(timeSig.d).toBe(4);
        expect(bpm).toBe(130);
    });

    it("error_double_melody.mid は全トラックを単音として判定する", () => {
        const analyzed = analyzeTracks(parseMidiFixture("error_double_melody.mid"));

        analyzed.forEach((track) => {
            expect(track.isChord).toBe(false);
        });
    });

    it("error_too_many_tracks.mid で3トラック以上を検出できる", () => {
        const analyzed = analyzeTracks(parseMidiFixture("error_too_many_tracks.mid"));

        expect(analyzed.length).toBeGreaterThanOrEqual(3);
    });

    it("logic_2tracks.mid で空トラックを除外対象として識別できる", () => {
        const analyzed = analyzeTracks(parseMidiFixture("logic_2tracks.mid"));
        const validTracks = analyzed.filter((track) => track.notes.length > 0);

        expect(analyzed[0]?.notes.length).toBe(0);
        expect(validTracks.length).toBe(2);
        validTracks.forEach((track) => {
            expect(track.notes.length).toBeGreaterThan(0);
        });
    });
});
