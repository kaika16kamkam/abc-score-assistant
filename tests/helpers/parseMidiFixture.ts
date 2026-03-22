import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { parseMidiBinary } from "../../src/midiUtils.ts";
import type { ParsedTrack } from "../../src/type.ts";

const currentDir = dirname(fileURLToPath(import.meta.url));

export const parseMidiFixture = (fileName: string): ParsedTrack[] => {
    const filePath = join(currentDir, "../../data", fileName);
    const buffer = readFileSync(filePath);
    return parseMidiBinary(new Uint8Array(buffer));
};
