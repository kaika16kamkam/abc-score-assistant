// ABC SCORE ASSISTANT

// --- 定数定義 ---
/** MIDIノート番号に対応する音名リスト */
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
export const generateAbcHeader = (fileName, timeSig = { n: 4, d: 4 }, bpm = 120) => {
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
export const convertTrackToAbc = (notes, resolution, timeSig = { n: 4, d: 4 }) => {
    if (!notes || notes.length === 0) return "";

    let abcString = "";
    const baseTick = resolution / 2; 
    const ticksPerBar = resolution * timeSig.n; 
    let currentTick = 0; 

    const groups = [];
    notes.forEach(note => {
        const lastGroup = groups[groups.length - 1];
        if (lastGroup && lastGroup.tick === note.tick) {
            lastGroup.notes.push(note.note);
        } else {
            groups.push({ tick: note.tick, notes: [note.note] });
        }
    });

    groups.forEach((group, i) => {
        if (group.tick > currentTick) {
            const restLength = Math.round((group.tick - currentTick) / baseTick);
            if (restLength > 0) abcString += "z" + (restLength <= 1 ? "" : restLength) + " ";
            currentTick = group.tick; 
        }

        let notePart = group.notes.length > 1 
            ? `[${group.notes.map(n => getNoteName(n)).join("")}]`
            : getNoteName(group.notes[0]);

        let durationTicks = (i < groups.length - 1) ? groups[i + 1].tick - group.tick : resolution;
        const length = Math.round(durationTicks / baseTick);
        abcString += notePart + (length <= 1 ? "" : length) + " ";
        currentTick += durationTicks;

        if (Math.round(currentTick % ticksPerBar) === 0) {
            abcString += "| ";
            if (Math.round(currentTick % (ticksPerBar * 2)) === 0) abcString += "\n";
        }
    });
    return abcString;
};

/**
 * 拍子情報の抽出
 * @param {object} midiData MIDIデータ全体（parseMidiBinaryの結果を想定）
 * @returns {object} 拍子情報 { n: 4, d: 4 } の形式で返す
 */
export const extractTimeSignature = (midiData) => {
    // parseMidiBinaryの結果が配列なら、そこに保存されたメタデータを探す
    if (Array.isArray(midiData)) {
        const meta = midiData.find(t => t.timeSignature);
        return meta ? meta.timeSignature : { n: 4, d: 4 };
    }
    // 旧parser/テスト環境用
    if (midiData?.timeSignature) return midiData.timeSignature;
    return { n: 4, d: 4 };
};

/**
 * テンポの抽出
 * @param {object} midiData MIDIデータ全体（parseMidiBinaryの結果を想定）
 * @returns {number} テンポ（BPM）
 */
export const extractTempo = (midiData) => {
    if (Array.isArray(midiData)) {
        const meta = midiData.find(t => t.bpm);
        return meta ? meta.bpm : 120;
    }
    if (midiData?.bpm) return midiData.bpm;
    return 120;
};

/**
 * トラック解析 (isChord判定などを含む)
 * @param {object} midiData MIDIデータ全体（parseMidiBinaryの結果を想定）
 * @returns {Array} トラックごとの解析結果 [{ index: number, notes: Array, isChord: boolean }, ...]
 */
export const analyzeTracks = (midiData) => {
    // midiDataがすでに入れ子（parseMidiBinaryの結果）であることを想定
    return midiData.map((track, idx) => ({
        index: idx,
        notes: track.notes,
        isChord: track.notes.some((n, i) => i > 0 && Math.abs(n.tick - track.notes[i-1].tick) <= 10)
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
        readUint32() { return (this.readUint32_16() << 16) | this.readUint32_16(); },
        readUint32_16() { return (this.readByte() << 8) | this.readByte(); },
        readVarInt() {
            let res = 0;
            while (true) {
                let b = this.readByte();
                if (b & 0x80) { res = (res << 7) | (b & 0x7f); }
                else { return (res << 7) | b; }
            }
        }
    };

    reader.pos = 8; 
    const format = reader.readUint16();
    const trackCount = reader.readUint16();
    const resolution = reader.readUint16();

    const tracks = [];
    // ファイル全体で共有するメタデータの初期値
    let globalTimeSig = { n: 4, d: 4 };
    let globalBpm = 120;

    for (let i = 0; i < trackCount; i++) {
        reader.pos += 4; 
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
            if (type === 0x9) { // Note On
                const note = reader.readByte();
                const vel = reader.readByte();
                if (vel > 0) notes.push({ tick: absoluteTick, note, velocity: vel });
            } else if (type === 0x8) { 
                reader.pos += 2;
            } else if (status === 0xFF) { // Meta Event
                const metaType = reader.readByte();
                const mlen = reader.readVarInt();
                
                if (metaType === 0x58) { // Time Signature (拍子)
                    globalTimeSig = {
                        n: reader.readByte(),
                        d: Math.pow(2, reader.readByte())
                    };
                    reader.pos += (mlen - 2); // 残りのバイト（クロック数など）を飛ばす
                } else if (metaType === 0x51) { // Tempo (テンポ)
                    const mspb = (reader.readByte() << 16) | (reader.readByte() << 8) | reader.readByte();
                    globalBpm = Math.round(60000000 / mspb);
                } else {
                    reader.pos += mlen;
                }
            } else if (type === 0xA || type === 0xB || type === 0xE) {
                reader.pos += 2;
            } else if (type === 0xC || type === 0xD) {
                reader.pos += 1;
            } else if (status === 0xF0 || status === 0xF7) {
                const slen = reader.readVarInt();
                reader.pos += slen;
            }
        }
        // 音符があるトラック、または最初のトラックにメタデータを付与して保存
        if (notes.length > 0 || i === 0) {
            tracks.push({ 
                notes, 
                resolution, 
                timeSignature: globalTimeSig, 
                bpm: globalBpm 
            });
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
            
            const analyzed = analyzeTracks(parsedTracks);
            const timeSig = extractTimeSignature(parsedTracks);
            const bpm = extractTempo(parsedTracks);

            let abcFull = generateAbcHeader(file.name, timeSig, bpm);

            analyzed.forEach((track) => {
                debugLog += `Track ${track.index}: ${track.isChord ? 'コード' : 'メロディ'} (${track.notes.length}音)\n`;
                abcFull += `V:${track.index + 1} name="${track.isChord ? 'Chord' : 'Melody'}"\n`;
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