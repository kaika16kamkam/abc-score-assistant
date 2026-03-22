import { ABC_NOTE_NAMES, MIDI_CONFIG } from "./constants.js";
import type { MidiNote, TimeSignature } from "./type.js";

/**
 * MIDIノート番号をABC記法の音名に変換する。
 */
export const getNoteName = (midiNumber: number): string => {
	const index = midiNumber % 12;
	const noteName = ABC_NOTE_NAMES[index] ?? "C";
	const octave = Math.floor(midiNumber / 12) - 5;

	if (octave === 0) return noteName;
	if (octave === 1) return noteName.toLowerCase();
	if (octave > 1) return noteName.toLowerCase() + "'".repeat(octave - 1);
	if (octave < 0) return noteName + ",".repeat(Math.abs(octave));

	return noteName;
};

/**
 * ABCヘッダーを生成する。
 */
export const generateAbcHeader = (
	fileName: string,
	timeSig: TimeSignature = MIDI_CONFIG.DEFAULT_TIME_SIG,
	bpm: number = MIDI_CONFIG.DEFAULT_BPM,
): string => {
	const title = fileName.replace(/\.[^/.]+$/, "");
	return `X:1\nT:${title}\nM:${timeSig.n}/${timeSig.d}\nL:1/8\nQ:${bpm}\nK:C\n`;
};

/**
 * 1トラック分のノート列をABC記法へ変換する。
 */
export const convertTrackToAbc = (
	notes: MidiNote[],
	resolution: number,
	timeSig: TimeSignature = MIDI_CONFIG.DEFAULT_TIME_SIG,
): string => {
	if (!notes || notes.length === 0) return "";

	let abcString = "";
	const baseTick = resolution / 2;
	const ticksPerBar = (resolution * 4 * timeSig.n) / timeSig.d;
	let currentTick = 0;
	let barCount = 0;

	const insertBar = () => {
		abcString += " | ";
		barCount++;
		if (barCount % 4 === 0) {
			abcString += "\n";
		}
	};

	const groups: Array<{ tick: number; notes: number[] }> = [];
	notes.forEach((note) => {
		const lastGroup = groups[groups.length - 1];
		if (lastGroup && lastGroup.tick === note.tick) {
			lastGroup.notes.push(note.note);
		} else {
			groups.push({ tick: note.tick, notes: [note.note] });
		}
	});

	groups.forEach((group, i) => {
		while (currentTick < group.tick) {
			const nextBoundary = Math.floor(currentTick / ticksPerBar + 1) * ticksPerBar;
			const targetTick = Math.min(group.tick, nextBoundary);
			const duration = targetTick - currentTick;

			if (duration > 0) {
				const restLen = Math.round(duration / baseTick);
				if (restLen > 0) {
					abcString += `z${restLen <= 1 ? "" : restLen} `;
				}
			}

			currentTick = targetTick;
			if (currentTick === nextBoundary) {
				insertBar();
			}
		}

		const notePart =
			group.notes.length > 1
				? `[${group.notes.map((n) => getNoteName(n)).join("")}]`
				: getNoteName(group.notes[0]!);

		const nextNoteStart = i < groups.length - 1 ? (groups[i + 1]?.tick ?? group.tick + resolution) : group.tick + resolution;
		let remainingDuration = nextNoteStart - group.tick;

		while (remainingDuration > 0) {
			const nextBoundary = Math.floor(currentTick / ticksPerBar + 1) * ticksPerBar;
			const currentChunk = Math.min(remainingDuration, nextBoundary - currentTick);

			const length = Math.round(currentChunk / baseTick);
			abcString += `${notePart}${length <= 1 ? "" : length}`;

			remainingDuration -= currentChunk;
			currentTick += currentChunk;

			if (currentTick === nextBoundary) {
				if (remainingDuration > 0) {
					abcString += "-";
				}
				insertBar();
			} else {
				abcString += " ";
			}
		}
	});

	if (!abcString.trim().endsWith("|")) {
		abcString += " |";
	}

	return abcString;
};