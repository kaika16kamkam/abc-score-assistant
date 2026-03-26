import { describe, expect, it } from "vitest";

import { convertTrackToAbc } from "../src/abcConverter.ts";
import { analyzeTracks } from "../src/midiUtils.ts";
import { parseMidiFixture } from "./helpers/parseMidiFixture.ts";

describe("midi to abc integration", () => {
    it("空トラック除外後の先頭トラックがABCとして空文字列にならない", () => {
        const midiData = parseMidiFixture("logic.mid");
        const resolution = midiData[0]?.resolution;
        const validTracks = analyzeTracks(midiData).filter((track) => track.notes.length > 0);

        expect(resolution).toBeTypeOf("number");

        const abc = convertTrackToAbc(validTracks[0]!.notes, resolution as number);

        expect(abc).toMatch(/[A-Ga-g]/);
    });
});
