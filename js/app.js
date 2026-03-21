/**
 * ABC SCORE ASSISTANT - 共通ロジック
 */

// --- 定数定義 ---
export const MIDI_CONFIG = {
    DEFAULT_BPM: 120,
    DEFAULT_TIME_SIG: { n: 4, d: 4 },
    MICROSECONDS_PER_MINUTE: 60000000,
    CHORD_THRESHOLD_TICKS: 10
};

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
};

export const MIDI_META = {
    TEMPO: 0x51,
    TIME_SIGNATURE: 0x58
};

export const ABC_NOTE_NAMES = ["C", "^C", "D", "^D", "E", "F", "^F", "G", "^G", "A", "^A", "B"];

// --- ロジック部分 ---

/**
 * MIDIノート番号から音名を取得
 * @param {number} midiNumber MIDIノート番号 (例: 60 = 中央C)
 * @returns {string} ABC記法の音名 (例: C, D, E, F, G, A, B + オクターブ表記)
 */
export const getNoteName = (midiNumber) => {
    const index = midiNumber % 12;
    const noteName = ABC_NOTE_NAMES[index];
    const octave = Math.floor(midiNumber / 12) - 5; 

    if (octave === 0) return noteName; 
    if (octave === 1) return noteName.toLowerCase(); 
    if (octave > 1) return noteName.toLowerCase() + "'".repeat(octave - 1); 
    if (octave < 0) return noteName + ",".repeat(Math.abs(octave)); 
    
    return noteName;
};

/**
 * ABC記法のヘッダー部分を生成する
 * @param {string} fileName MIDIファイル名（拡張子なしでタイトルに使用）
 * @param {object} timeSig 拍子情報 { n: 4, d: 4 } の形式で指定
 * @param {number} bpm テンポ（BPM）
 * @returns {string} ABC記法のヘッダーテキスト
 */
export const generateAbcHeader = (fileName, timeSig = MIDI_CONFIG.DEFAULT_TIME_SIG, bpm = MIDI_CONFIG.DEFAULT_BPM) => {
    const title = fileName.replace(/\.[^/.]+$/, "");
    return `X:1\nT:${title}\nM:${timeSig.n}/${timeSig.d}\nL:1/8\nQ:${bpm}\nK:C\n`;
};

/**
 * トラックのノート配列をABC記法に変換
 * @param {Array} notes MIDIノートイベントの配列 [{ tick: number, note: number }, ...]
 * @param {number} resolution MIDIの分解能（例: 480）
 * @param {object} timeSig 拍子情報 { n: 4, d: 4 } の形式で指定
 * @returns {string} ABC記法のノート部分テキスト
 */
export const convertTrackToAbc = (notes, resolution, timeSig = MIDI_CONFIG.DEFAULT_TIME_SIG) => {
    if (!notes || notes.length === 0) return "";

    let abcString = "";
    const baseTick = resolution / 2; // L:1/8 (8分音符基準)
    const ticksPerBar = resolution * timeSig.n; 
    let currentTick = 0; 
    let barCount = 0; // 小節数をカウントして改行を制御

    // 小節線と改行を挿入する共通関数
    const insertBar = () => {
        abcString += " | ";
        barCount++;
        if (barCount % 4 === 0) {
            abcString += "\n";
        }
    };

    // 1. ノートを同じタイミングでグループ化（和音対応）
    const groups = [];
    notes.forEach(note => {
        const lastGroup = groups[groups.length - 1];
        if (lastGroup && lastGroup.tick === note.tick) {
            lastGroup.notes.push(note.note);
        } else {
            groups.push({ tick: note.tick, notes: [note.note] });
        }
    });

    // 2. メインループ
    groups.forEach((group, i) => {
        
        // --- A. 次の音符までの「空白（休符）」を埋める ---
        while (currentTick < group.tick) {
            const nextBoundary = Math.floor(currentTick / ticksPerBar + 1) * ticksPerBar;
            const targetTick = Math.min(group.tick, nextBoundary);
            const duration = targetTick - currentTick;

            if (duration > 0) {
                const restLen = Math.round(duration / baseTick);
                if (restLen > 0) abcString += "z" + (restLen <= 1 ? "" : restLen) + " ";
            }

            currentTick = targetTick;
            if (currentTick === nextBoundary) insertBar();
        }

        // --- B. 「音符（単音 or 和音）」を出力する ---
        const notePart = group.notes.length > 1 
            ? `[${group.notes.map(n => getNoteName(n)).join("")}]`
            : getNoteName(group.notes[0]);

        // この音符のトータルの長さを計算
        // 次の音の開始位置、なければ1拍分(resolution)確保
        const nextNoteStart = (i < groups.length - 1) ? groups[i + 1].tick : group.tick + resolution;
        let remainingDuration = nextNoteStart - group.tick;

        // 音符も小節を跨ぐ場合は分割してタイ(-)で繋ぐ
        while (remainingDuration > 0) {
            const nextBoundary = Math.floor(currentTick / ticksPerBar + 1) * ticksPerBar;
            const currentChunk = Math.min(remainingDuration, nextBoundary - currentTick);
            
            const length = Math.round(currentChunk / baseTick);
            abcString += notePart + (length <= 1 ? "" : length);

            remainingDuration -= currentChunk;
            currentTick += currentChunk;

            if (currentTick === nextBoundary) {
                if (remainingDuration > 0) abcString += "-"; // まだ続きがあればタイで繋ぐ
                insertBar();
            } else {
                abcString += " "; // 小節内ならスペースを空ける
            }
        }
    });

    // 最後に小節線がなければ閉じる
    if (!abcString.trim().endsWith("|")) {
        abcString += " |";
    }

    return abcString;
};

/**
 * 拍子情報の抽出
 * @param {object} midiData MIDIデータ全体（parseMidiBinaryの結果を想定）
 * @returns {object} 拍子情報 { n: 4, d: 4 } の形式で返す
 */
export const extractTimeSignature = (midiData) => {
    const source = Array.isArray(midiData) ? midiData.find(t => t.timeSignature) : midiData;
    return source?.timeSignature || MIDI_CONFIG.DEFAULT_TIME_SIG;
};

/**
 * テンポの抽出
 * @param {object} midiData MIDIデータ全体（parseMidiBinaryの結果を想定）
 * @returns {number} テンポ（BPM）
 */
export const extractTempo = (midiData) => {
    const source = Array.isArray(midiData) ? midiData.find(t => t.bpm) : midiData;
    return source?.bpm || MIDI_CONFIG.DEFAULT_BPM;
};

/**
 * トラック解析
 */
export const analyzeTracks = (midiData) => {
    return midiData.map((track, idx) => ({
        index: idx,
        notes: track.notes,
        isChord: track.notes.some((n, i) => 
            i > 0 && Math.abs(n.tick - track.notes[i-1].tick) <= MIDI_CONFIG.CHORD_THRESHOLD_TICKS
        )
    }));
};

/**
 * MIDIバイナリ解析（Logic Pro / Running Status対応版）
 * @param {Uint8Array} data MIDIファイルのバイナリデータ
 * @returns {Array} トラックごとのノート情報 [{ notes: Array, resolution: number }, ...]
 */
export const parseMidiBinary = (data) => {
    const reader = {
        pos: 0,
        readByte() { return data[this.pos++]; },
        readUint16() { return (this.readByte() << 8) | this.readByte(); },
        readVarInt() {
            let res = 0;
            while (true) {
                let b = this.readByte();
                if (b & 0x80) { res = (res << 7) | (b & 0x7f); }
                else { return (res << 7) | b; }
            }
        }
    };

    reader.pos = 8; // MThdヘッダーをスキップ
    const format = reader.readUint16();
    const trackCount = reader.readUint16();
    const resolution = reader.readUint16();

    const tracks = [];
    // ファイル全体で共有するメタデータの初期値
    let globalTimeSig = MIDI_CONFIG.DEFAULT_TIME_SIG;
    let globalBpm = MIDI_CONFIG.DEFAULT_BPM;

    for (let i = 0; i < trackCount; i++) {
        reader.pos += 4; // "MTrk"
        const len = (reader.readByte() << 24) | (reader.readByte() << 16) | (reader.readByte() << 8) | reader.readByte();
        const endPos = reader.pos + len;
        
        let absoluteTick = 0;
        let lastStatus = 0;
        const notes = [];

        while (reader.pos < endPos) {
            absoluteTick += reader.readVarInt();
            let status = reader.readByte();

            if (status < 0x80) {
                status = lastStatus;
                reader.pos--;
            } else {
                lastStatus = status;
            }

            const type = status >> 4;
            
            if (type === MIDI_EVENT.NOTE_ON) {
                const note = reader.readByte();
                const vel = reader.readByte();
                if (vel > 0) notes.push({ tick: absoluteTick, note, velocity: vel });
            } else if (type === MIDI_EVENT.NOTE_OFF) {
                reader.pos += 2;
            } else if (status === MIDI_EVENT.META) {
                const metaType = reader.readByte();
                const mlen = reader.readVarInt();
                
                if (metaType === MIDI_META.TIME_SIGNATURE) {
                    globalTimeSig = {
                        n: reader.readByte(),
                        d: Math.pow(2, reader.readByte())
                    };
                    reader.pos += (mlen - 2); // 残りのバイト（クロック数など）を飛ばす
                } else if (metaType === MIDI_META.TEMPO) {
                    const mspb = (reader.readByte() << 16) | (reader.readByte() << 8) | reader.readByte();
                    globalBpm = Math.round(MIDI_CONFIG.MICROSECONDS_PER_MINUTE / mspb);
                } else {
                    reader.pos += mlen;
                }
            } else if (type === MIDI_EVENT.POLY_AFTERTOUCH || type === MIDI_EVENT.CONTROL_CHANGE || type === MIDI_EVENT.PITCH_BEND) {
                reader.pos += 2;
            } else if (type === MIDI_EVENT.PROGRAM_CHANGE || type === MIDI_EVENT.CHANNEL_AFTERTOUCH) {
                reader.pos += 1;
            } else if (status === MIDI_EVENT.SYSEX_START || status === MIDI_EVENT.SYSEX_END) {
                reader.pos += reader.readVarInt();
            }
        }
        // 音符があるトラック、または最初のトラックにメタデータを付与して保存
        if (notes.length > 0 || i === 0) {
            tracks.push({ notes, resolution, timeSignature: globalTimeSig, bpm: globalBpm });
        }
    }
    return tracks;
};

// --- UI操作部分 ---
if (typeof document !== 'undefined') {
    const fileInput = document.getElementById('file');
    const output = document.getElementById('output');
    const abcResult = document.getElementById('abc-result');
    const abcSection = document.getElementById('abcSection');

    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const buffer = new Uint8Array(await file.arrayBuffer());
            const parsedTracks = parseMidiBinary(buffer);

            if (parsedTracks.length === 0) throw new Error("音符が見つかりませんでした。");

            const resolution = parsedTracks[0].resolution;
            let debugLog = `【解析成功: ${file.name}】\n`;
            
            const analyzed = analyzeTracks(parsedTracks).filter(t => t.notes.length > 0);
            const timeSig = extractTimeSignature(parsedTracks);
            const bpm = extractTempo(parsedTracks);

            let abcFull = generateAbcHeader(file.name, timeSig, bpm);

            // 有効なトラック（音符あり）だけを回す
            analyzed.forEach((track, i) => {
                // 表示上のインデックスを見やすく（Track 1, 2...）
                const displayIdx = i + 1; 
                debugLog += `Track ${displayIdx}: ${track.isChord ? 'コード' : 'メロディ'} (${track.notes.length}音)\n`;
                
                // ABC記法のボイス番号も連番にする
                abcFull += `V:${displayIdx} name="${track.isChord ? 'Chord' : 'Melody'}"\n`;
                abcFull += convertTrackToAbc(track.notes, resolution, timeSig) + "\n";
            });

            output.textContent = debugLog + "\n【チェックOK！】";
            abcResult.textContent = abcFull;
            abcSection.style.display = 'block';

        } catch (err) {
            output.style.color = 'red';
            output.textContent = '解析エラー: ' + err.message;
        }
    };
}