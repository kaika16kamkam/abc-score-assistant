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

const fallbackCopyText = (text: string): boolean => {
	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.setAttribute("readonly", "");
	textarea.style.position = "fixed";
	textarea.style.opacity = "0";
	document.body.appendChild(textarea);
	textarea.select();

	const copied = document.execCommand("copy");
	document.body.removeChild(textarea);
	return copied;
};

const copyTextToClipboard = async (text: string): Promise<void> => {
	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return;
		} catch {
			// file:// 環境などで Clipboard API が失敗した場合のフォールバック
		}
	}

	if (!fallbackCopyText(text)) {
		throw new Error("コピーに失敗しました。");
	}
};

const initializeUi = () => {
	const fileInput = getRequiredElement<HTMLInputElement>("file");
	const output = getRequiredElement<HTMLElement>("output");
	const abcResult = getRequiredElement<HTMLElement>("abc-result");
	const abcSection = getRequiredElement<HTMLElement>("abcSection");
	const copyButton = getRequiredElement<HTMLButtonElement>("copy-abc-button");
	const copyStatus = getRequiredElement<HTMLElement>("copy-status");

	copyButton.onclick = async () => {
		const abcText = abcResult.textContent?.trim();
		if (!abcText) {
			copyStatus.style.color = "#a33";
			copyStatus.textContent = "コピー対象がありません。";
			return;
		}

		try {
			await copyTextToClipboard(abcText);
			copyStatus.style.color = "#2d7a2d";
			copyStatus.textContent = "コピーしました。";
		} catch {
			copyStatus.style.color = "#a33";
			copyStatus.textContent = "コピーに失敗しました。";
		}
	};

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
			copyStatus.textContent = "";
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