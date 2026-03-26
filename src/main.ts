import { convertTrackToAbc, generateAbcHeader } from "./abcConverter.js";
import { analyzeTracks, extractTempo, extractTimeSignature, parseMidiBinary } from "./midiUtils.js";

export { convertTrackToAbc, generateAbcHeader } from "./abcConverter.js";
export { analyzeTracks, extractTempo, extractTimeSignature, parseMidiBinary } from "./midiUtils.js";

const getRequiredElement = <T extends HTMLElement>(id: string): T => {
	const element = document.getElementById(id);
	if (!element) {
		throw new Error(`要素が見つかりません: #${id}`);
	}
	return element as T;
};

const initializeUi = () => {
	const fileInput = getRequiredElement<HTMLInputElement>("file");
	const output = getRequiredElement<HTMLElement>("output");
	const abcResult = getRequiredElement<HTMLElement>("abc-result");
	const abcSection = getRequiredElement<HTMLElement>("abcSection");

	fileInput.onchange = async (e: Event) => {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		try {
			const buffer = new Uint8Array(await file.arrayBuffer());
			const parsedTracks = parseMidiBinary(buffer);

			if (parsedTracks.length === 0) {
				throw new Error("音符が見つかりませんでした。");
			}

			const resolution = parsedTracks[0]!.resolution;
			let debugLog = `【解析成功: ${file.name}】\n`;

			const analyzed = analyzeTracks(parsedTracks).filter((t) => t.notes.length > 0);
			const timeSig = extractTimeSignature(parsedTracks);
			const bpm = extractTempo(parsedTracks);

			let abcFull = generateAbcHeader(file.name, timeSig, bpm);

			analyzed.forEach((track, i) => {
				const displayIdx = i + 1;
				debugLog += `Track ${displayIdx}: ${track.isChord ? "コード" : "メロディ"} (${track.notes.length}音)\n`;

				abcFull += `V:${displayIdx} name="${track.isChord ? "Chord" : "Melody"}"\n`;
				abcFull += `${convertTrackToAbc(track.notes, resolution, timeSig)}\n`;
			});

			output.style.color = "";
			output.textContent = `${debugLog}\n【チェックOK！】`;
			abcResult.textContent = abcFull;
			abcSection.style.display = "block";
		} catch (error) {
			output.style.color = "red";
			output.textContent = `解析エラー: ${(error as Error).message}`;
		}
	};
};

if (typeof document !== "undefined") {
	initializeUi();
}