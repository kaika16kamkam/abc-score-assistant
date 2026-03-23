import { MIDI_CONFIG, MIDI_EVENT, MIDI_META } from "./constants.js";
import type { AnalyzerResult, ParsedTrack, TimeSignature } from "./type.js";

/**
 * MIDIデータから拍子情報を取得する。
 */
export const extractTimeSignature = (midiData: ParsedTrack[] | ParsedTrack): TimeSignature => {
	const source = Array.isArray(midiData) ? midiData.find((t) => t.timeSignature) : midiData;
	return source?.timeSignature || MIDI_CONFIG.DEFAULT_TIME_SIG;
};

/**
 * MIDIデータからテンポを取得する。
 */
export const extractTempo = (midiData: ParsedTrack[] | ParsedTrack): number => {
	const source = Array.isArray(midiData) ? midiData.find((t) => t.bpm) : midiData;
	return source?.bpm || MIDI_CONFIG.DEFAULT_BPM;
};

/**
 * トラックを和音/メロディとして簡易判定する。
 */
export const analyzeTracks = (midiData: ParsedTrack[]): AnalyzerResult[] => {
	return midiData.map((track, idx) => ({
		index: idx,
		notes: track.notes,
		isChord: track.notes.some(
			(n, i) => i > 0 && Math.abs(n.tick - (track.notes[i - 1]?.tick ?? n.tick)) <= MIDI_CONFIG.CHORD_THRESHOLD_TICKS,
		),
	}));
};

/**
 * Running Statusを考慮したMIDIバイナリパーサー。
 */
export const parseMidiBinary = (data: Uint8Array): ParsedTrack[] => {
	const reader = {
		pos: 0,
		readByte() {
			const value = data[this.pos++];
			if (value === undefined) {
				throw new Error("MIDI読み取り中に予期せぬ終端に到達しました。");
			}
			return value;
		},
		readUint16() {
			return (this.readByte() << 8) | this.readByte();
		},
		readVarInt() {
			let res = 0;
			while (true) {
				const b = this.readByte();
				if (b & 0x80) {
					res = (res << 7) | (b & 0x7f);
				} else {
					return (res << 7) | b;
				}
			}
		},
	};

	reader.pos = 8;
	reader.readUint16(); // format
	const trackCount = reader.readUint16();
	const resolution = reader.readUint16();

	const tracks: ParsedTrack[] = [];
	let globalTimeSig: TimeSignature = MIDI_CONFIG.DEFAULT_TIME_SIG;
	let globalBpm: number = MIDI_CONFIG.DEFAULT_BPM;

	for (let i = 0; i < trackCount; i++) {
		reader.pos += 4; // MTrk
		const len =
			(reader.readByte() << 24) |
			(reader.readByte() << 16) |
			(reader.readByte() << 8) |
			reader.readByte();
		const endPos = reader.pos + len;

		let absoluteTick = 0;
		let lastStatus = 0;
		const notes: ParsedTrack["notes"] = [];

		while (reader.pos < endPos) {
			absoluteTick += reader.readVarInt();
			let status = reader.readByte();

			if (status < 0x80) {
				if (lastStatus === 0) {
					throw new Error("不正なMIDIです: Running Statusのステータスが未初期化です。");
				}
				status = lastStatus;
				reader.pos--;
			} else {
				lastStatus = status;
			}

			const type = status >> 4;

			if (type === MIDI_EVENT.NOTE_ON) {
				const note = reader.readByte();
				const vel = reader.readByte();
				if (vel > 0) {
					notes.push({ tick: absoluteTick, note, velocity: vel });
				}
			} else if (type === MIDI_EVENT.NOTE_OFF) {
				reader.pos += 2;
			} else if (status === MIDI_EVENT.META) {
				const metaType = reader.readByte();
				const mlen = reader.readVarInt();

				if (metaType === MIDI_META.TIME_SIGNATURE) {
					globalTimeSig = {
						n: reader.readByte(),
						d: Math.pow(2, reader.readByte()),
					};
					reader.pos += mlen - 2;
				} else if (metaType === MIDI_META.TEMPO) {
					const mspb = (reader.readByte() << 16) | (reader.readByte() << 8) | reader.readByte();
					globalBpm = Math.round(MIDI_CONFIG.MICROSECONDS_PER_MINUTE / mspb);
				} else {
					reader.pos += mlen;
				}
			} else if (
				type === MIDI_EVENT.POLY_AFTERTOUCH ||
				type === MIDI_EVENT.CONTROL_CHANGE ||
				type === MIDI_EVENT.PITCH_BEND
			) {
				reader.pos += 2;
			} else if (type === MIDI_EVENT.PROGRAM_CHANGE || type === MIDI_EVENT.CHANNEL_AFTERTOUCH) {
				reader.pos += 1;
			} else if (status === MIDI_EVENT.SYSEX_START || status === MIDI_EVENT.SYSEX_END) {
				reader.pos += reader.readVarInt();
			} else {
				throw new Error(`不明なMIDIイベントを検出しました: status=0x${status.toString(16)} at track=${i}, pos=${reader.pos}`);
			}
		}

		if (notes.length > 0 || i === 0) {
			tracks.push({ notes, resolution, timeSignature: globalTimeSig, bpm: globalBpm });
		}
	}

	return tracks;
};