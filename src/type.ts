export interface TimeSignature {
    n: number;
    d: number;
}

export interface MidiNote {
    tick: number;
    note: number;
    velocity?: number;
}

export interface ParsedTrack {
    notes: MidiNote[];
    resolution: number;
    timeSignature: TimeSignature;
    bpm: number;
    isChord?: boolean;
}

export interface AnalyzerResult {
    index: number;
    notes: MidiNote[];
    isChord: boolean;
}