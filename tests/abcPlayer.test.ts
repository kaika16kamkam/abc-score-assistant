import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AbcPlayer } from "../src/abcPlayer.ts";

type Deferred = {
	promise: Promise<void>;
	resolve: () => void;
};

type MockSynth = {
	init: ReturnType<typeof vi.fn<() => Promise<void>>>;
	prime: ReturnType<typeof vi.fn<() => Promise<void>>>;
	start: ReturnType<typeof vi.fn<() => Promise<void>>>;
	stop: ReturnType<typeof vi.fn<() => void>>;
};

type TestWindow = Window & {
	ABCJS?: unknown;
};

function createDeferred(): Deferred {
	let resolve!: () => void;
	const promise = new Promise<void>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

function createRenderHost(): HTMLElement {
	return {
		classList: {
			add: vi.fn(),
			remove: vi.fn(),
		},
		style: {
			display: "",
			height: "",
			minHeight: "",
			marginTop: "",
			paddingBottom: "",
		},
		querySelectorAll: vi.fn(() => []),
		innerHTML: "",
	} as unknown as HTMLElement;
}

function createSynth(options?: {
	init?: () => Promise<void>;
	prime?: () => Promise<void>;
	start?: () => Promise<void>;
}): MockSynth {
	return {
		init: vi.fn(options?.init ?? (async () => {})),
		prime: vi.fn(options?.prime ?? (async () => {})),
		start: vi.fn(options?.start ?? (async () => {})),
		stop: vi.fn(),
	};
}

describe("AbcPlayer", () => {
	const originalWindow = globalThis.window;

	beforeEach(() => {
		(
			globalThis as typeof globalThis & {
				window: Window & typeof globalThis;
			}
		).window = {} as unknown as Window & typeof globalThis;
	});

	afterEach(() => {
		(globalThis as typeof globalThis & { window: Window | undefined }).window =
			originalWindow;
	});

	it("初回ロード中に stop すると再生開始まで進まない", async () => {
		const renderHost = createRenderHost();
		const initDeferred = createDeferred();
		const synth = createSynth({
			init: () => initDeferred.promise,
		});
		const createSynthMock = vi.fn();
		const CreateSynth = function () {
			createSynthMock();
			return synth;
		};
		const renderAbcMock = vi.fn(() => [{}]);

		(globalThis.window as unknown as TestWindow).ABCJS = {
			renderAbc: renderAbcMock,
			synth: {
				CreateSynth,
			},
		};

		const player = new AbcPlayer(renderHost);
		player.setSource("X:1\nK:C\nC");

		const playPromise = player.play();
		player.stop();
		initDeferred.resolve();
		await playPromise;

		expect(createSynthMock).toHaveBeenCalledTimes(1);
		expect(synth.stop).toHaveBeenCalledTimes(1);
		expect(synth.prime).not.toHaveBeenCalled();
		expect(synth.start).not.toHaveBeenCalled();
		expect(renderAbcMock).toHaveBeenCalledTimes(1);
	});

	it("再生ボタン連打時は古い再生要求が開始されない", async () => {
		const renderHost = createRenderHost();
		const firstInitDeferred = createDeferred();
		const secondInitDeferred = createDeferred();

		const firstSynth = createSynth({
			init: () => firstInitDeferred.promise,
		});
		const secondSynth = createSynth({
			init: () => secondInitDeferred.promise,
		});
		const createSynthMock = vi.fn();
		const CreateSynth = function () {
			createSynthMock();
			return createSynthMock.mock.calls.length === 1 ? firstSynth : secondSynth;
		};

		(globalThis.window as unknown as TestWindow).ABCJS = {
			renderAbc: vi.fn(() => [{}]),
			synth: {
				CreateSynth,
			},
		};

		const player = new AbcPlayer(renderHost);
		player.setSource("X:1\nK:C\nC");

		const firstPlay = player.play();
		const secondPlay = player.play();

		secondInitDeferred.resolve();
		await secondPlay;

		firstInitDeferred.resolve();
		await firstPlay;

		expect(firstSynth.stop).toHaveBeenCalledTimes(1);
		expect(firstSynth.prime).not.toHaveBeenCalled();
		expect(firstSynth.start).not.toHaveBeenCalled();
		expect(secondSynth.prime).toHaveBeenCalledTimes(1);
		expect(secondSynth.start).toHaveBeenCalledTimes(1);
	});
});
