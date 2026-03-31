import { convertTrackToAbc, generateAbcHeader } from "./abcConverter.js";
import { AbcSecurityError, sanitizeAbcInput } from "./abcInputSecurity.js";
import { AbcPlayer } from "./abcPlayer.js";
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
	let copied = false;

	try {
		document.body.appendChild(textarea);
		textarea.select();
		copied = document.execCommand("copy");
	} catch {
		copied = false;
	} finally {
		if (textarea.parentNode) {
			textarea.parentNode.removeChild(textarea);
		}
	}

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
	const debugLogPanel = getRequiredElement<HTMLDetailsElement>("debug-log");
	const abcInput = getRequiredElement<HTMLTextAreaElement>("abc-input");
	const openFileButton = getRequiredElement<HTMLButtonElement>("open-file-button");
	const copyButton = getRequiredElement<HTMLButtonElement>("copy-abc-button");
	const copyStatus = getRequiredElement<HTMLElement>("copy-status");
	const playButton = getRequiredElement<HTMLButtonElement>("play-abc-button");
	const stopButton = getRequiredElement<HTMLButtonElement>("stop-abc-button");
	const playStatus = getRequiredElement<HTMLElement>("play-status");
	const playbackRenderHost = getRequiredElement<HTMLElement>("abc-playback-render");
	const abcPlayer = new AbcPlayer(playbackRenderHost);

	openFileButton.onclick = () => {
		fileInput.click();
	};

	copyButton.onclick = async () => {
		const abcText = abcInput.value.trim();
		if (abcText === "") {
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

	playButton.onclick = async () => {
		const abcText = abcInput.value;

		try {
			const sanitized = sanitizeAbcInput(abcText);
			abcPlayer.setSource(sanitized.text);
			abcPlayer.updatePreview();
			await abcPlayer.play();
			playStatus.style.color = "#2d7a2d";
			playStatus.textContent = "再生中...";
		} catch (error) {
			playStatus.style.color = "#a33";
			playStatus.textContent = `再生エラー: ${(error as Error).message}`;
		}
	};

	abcInput.oninput = () => {
		abcPlayer.stop();
		copyStatus.style.color = "";
		copyStatus.textContent = "";

		try {
			const sanitized = sanitizeAbcInput(abcInput.value);
			abcPlayer.setSource(sanitized.text);
			abcPlayer.updatePreview();
			if (sanitized.warnings.length > 0) {
				playStatus.style.color = "#8a6d1d";
				playStatus.textContent = sanitized.warnings.join(" ");
			} else {
				playStatus.style.color = "";
				playStatus.textContent = "";
			}
		} catch (error) {
			playStatus.style.color = error instanceof AbcSecurityError ? "#a33" : "#a33";
			playStatus.textContent = `譜面表示エラー: ${(error as Error).message}`;
		}
	};

	stopButton.onclick = () => {
		abcPlayer.stop();
		playStatus.style.color = "";
		playStatus.textContent = "停止しました。";
	};

	fileInput.onchange = async (e: Event) => {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		abcPlayer.stop();
		playStatus.style.color = "";
		playStatus.textContent = "";

		copyStatus.style.color = "";
		copyStatus.textContent = "";

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
			abcInput.value = abcFull;
			const sanitized = sanitizeAbcInput(abcFull);
			abcPlayer.setSource(sanitized.text);
			abcPlayer.updatePreview();
			copyStatus.style.color = "";
			copyStatus.textContent = "";
			playStatus.style.color = "";
			playStatus.textContent = "";
		} catch (error) {
			output.style.color = "red";
			output.textContent = `解析エラー: ${(error as Error).message}`;
			debugLogPanel.open = true;
			copyStatus.style.color = "";
			copyStatus.textContent = "";
			abcPlayer.stop();
			abcPlayer.setSource("");
			try {
				abcPlayer.updatePreview();
				playStatus.style.color = "";
				playStatus.textContent = "";
			} catch {
				playStatus.style.color = "";
				playStatus.textContent = "";
			}
		}
	};
};

if (typeof document !== "undefined") {
	initializeUi();
}