type AbcRenderOptions = Record<string, unknown>;

type AbcJsSynthInitOptions = {
	visualObj: unknown;
	options?: {
		soundFontUrl?: string;
	};
};

interface AbcJsSynth {
	init(options: AbcJsSynthInitOptions): Promise<void>;
	prime(): Promise<void>;
	start(): Promise<void>;
	stop(): void;
}

interface AbcJsNamespace {
	renderAbc(target: HTMLElement, abc: string, options?: AbcRenderOptions): unknown[];
	synth: {
		CreateSynth: new () => AbcJsSynth;
	};
}

type WindowWithAbcJs = Window & {
	ABCJS?: AbcJsNamespace;
};

const PLAYBACK_RENDER_HIDDEN_CLASS = "playback-render-hidden";
const DEFAULT_SOUND_FONT_URL =
	"https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/";

/**
 * abcjsを使った譜面プレビュー/再生の薄いラッパー。
 * UI層はこのクラスを通じて表示・再生状態を制御する。
 */
export class AbcPlayer {
	private synth: AbcJsSynth | null = null;
	private sourceAbc = "";
	private visualObject: unknown | null = null;

	constructor(private readonly renderHost: HTMLElement) {}

	setSource(abcText: string): void {
		this.sourceAbc = abcText.trim();
	}

	/**
	 * 入力されたABCをパースして譜面表示を更新する。
	 * 空入力やパース失敗時は表示をクリアして非表示に戻す。
	 */
	updatePreview(): void {
		if (!this.sourceAbc) {
			this.visualObject = null;
			this.hidePreview();
			return;
		}

		const abcjs = this.getAbcJs();
		this.showPreviewHost();

		const visualObjects = abcjs.renderAbc(this.renderHost, this.sourceAbc, {
			responsive: "resize",
		});
		const visualObject = visualObjects[0];
		if (!visualObject) {
			this.visualObject = null;
			this.hidePreview();
			throw new Error("ABC記法の解析に失敗しました。");
		}

		this.visualObject = visualObject;
	}

	clear(): void {
		this.stop();
		this.sourceAbc = "";
		this.visualObject = null;
		this.hidePreview();
	}

	async play(): Promise<void> {
		if (!this.sourceAbc) {
			throw new Error("再生対象のABC記法がありません。");
		}

		this.stop();

		if (!this.visualObject) {
			this.updatePreview();
		}

		if (!this.visualObject) {
			throw new Error("ABC記法の解析に失敗しました。");
		}

		const abcjs = this.getAbcJs();

		const synth = new abcjs.synth.CreateSynth();
		await synth.init({
			visualObj: this.visualObject,
			options: {
				soundFontUrl: DEFAULT_SOUND_FONT_URL,
			},
		});
		await synth.prime();
		await synth.start();
		this.synth = synth;
	}

	stop(): void {
		if (this.synth) {
			this.synth.stop();
			this.synth = null;
		}
	}

	// abcjsが付与したinline styleを含めて表示状態を正規化する。
	private showPreviewHost(): void {
		this.renderHost.classList.remove(PLAYBACK_RENDER_HIDDEN_CLASS);
		this.renderHost.style.display = "";
		this.renderHost.style.height = "";
		this.renderHost.style.minHeight = "";
		this.renderHost.style.marginTop = "";
		this.renderHost.style.paddingBottom = "";
	}

	// 停止/入力不正時に譜面領域を完全に閉じて空白を残さない。
	private hidePreview(): void {
		this.renderHost.querySelectorAll("*").forEach((node) => {
			if (node instanceof HTMLElement) {
				node.style.height = "";
				node.style.minHeight = "";
				node.style.marginTop = "";
				node.style.paddingBottom = "";
			}
		});

		this.renderHost.innerHTML = "";
		this.renderHost.classList.add(PLAYBACK_RENDER_HIDDEN_CLASS);
		this.renderHost.style.display = "none";
		this.renderHost.style.height = "0";
		this.renderHost.style.minHeight = "0";
		this.renderHost.style.marginTop = "0";
		this.renderHost.style.paddingBottom = "0";
	}

	private getAbcJs(): AbcJsNamespace {
		const abcjs = (window as WindowWithAbcJs).ABCJS;
		if (!abcjs) {
			throw new Error("abcjsの読み込みに失敗しました。");
		}
		return abcjs;
	}
}
