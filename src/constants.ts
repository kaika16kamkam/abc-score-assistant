import type { TimeSignature } from "./type.js";

const DEFAULT_TIME_SIG: TimeSignature = { n: 4, d: 4 };

// --- 定数定義 ---
export const MIDI_CONFIG = {
    DEFAULT_BPM: 120,
    DEFAULT_TIME_SIG,
    MICROSECONDS_PER_MINUTE: 60000000,
    CHORD_THRESHOLD_TICKS: 10
} as const;

export const MIDI_EVENT = {
    NOTE_OFF: 0x08,
    NOTE_ON: 0x09,
    POLY_AFTERTOUCH: 0x0A,
    CONTROL_CHANGE: 0x0B,
    PROGRAM_CHANGE: 0x0C,
    CHANNEL_AFTERTOUCH: 0x0D,
    PITCH_BEND: 0x0E,
    META: 0xFF,
    SYSEX_START: 0xF0,
    SYSEX_END: 0xF7
} as const;

export const MIDI_META = {
    TEMPO: 0x51,
    TIME_SIGNATURE: 0x58
} as const;

export const ABC_NOTE_NAMES = ["C", "^C", "D", "^D", "E", "F", "^F", "G", "^G", "A", "^A", "B"] as const;