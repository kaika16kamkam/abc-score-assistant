// ABC SCORE ASSISTANT - 共通ロジック

// --- 定数定義 ---
/** MIDIイベントタイプ・メタイベントタイプ定数 */
export const MIDI_EVENT_TYPE_META = 255;
export const MIDI_META_TIME_SIGNATURE = 88;
export const MIDI_META_TEMPO = 81;
export const MIDI_EVENT_NOTE_ON = 9;

// --- ロジック部分（テストしたい関数） ---
/**
 * MIDIノート番号に対応する音名リスト
 * @type {string[]}
 */
export const ABC_NOTE_NAMES = ["C", "^C", "D", "^D", "E", "F", "^F", "G", "^G", "A", "^A", "B"];

/**
 * ABC記法のヘッダー部分を生成する関数
 * @param {string} fileName - ファイル名（拡張子付き）
 * @param {{n: number, d: number}} [timeSig={n:4,d:4}] - 拍子情報
 * @param {number} [bpm=120] - テンポ（BPM）
 * @returns {string} ABC記法のヘッダー文字列
 */
export const generateAbcHeader = (fileName, timeSig = { n: 4, d: 4 }, bpm = 120) => {
  const title = fileName.replace(/\.[^/.]+$/, "");
  return `X:1\nT:${title}\nM:${timeSig.n}/${timeSig.d}\nL:1/8\nQ:${bpm}\nK:C\n`;
};

/**
 * MIDIノート番号から音名（例: C4）を取得する関数
 * @param {number} midiNumber - MIDIノート番号
 * @returns {string} 音名（例: C4）
 */
export const getNoteName = (midiNumber) => {
  const index = midiNumber % 12;
  const noteName = ABC_NOTE_NAMES[index];
  
  // オクターブ判定 (MIDI 60 = 中央C = C)
  // 60〜71: C, D, E...
  // 72〜83: c, d, e... (小文字)
  // 48〜59: C,, D,, E,, (カンマ)
  
  const octave = Math.floor(midiNumber / 12) - 5; // 60のとき 0 になるように

  if (octave === 0) return noteName; // 中央オクターブ
  if (octave === 1) return noteName.toLowerCase(); // 1オクターブ上
  if (octave > 1) return noteName.toLowerCase() + "'".repeat(octave - 1); // 2オクターブ以上上 (c')
  if (octave < 0) return noteName + ",".repeat(Math.abs(octave)); // オクターブ下 (C,)
  
  return noteName;
};

/**
 * MIDIデータから拍子情報を抽出する関数
 * @param {object} midiData - パース済みMIDIデータ
 * @returns {{n: number, d: number}} 拍子情報オブジェクト
 */
export const extractTimeSignature = (midiData) => {
  let timeSig = { n: 4, d: 4 };
  
  midiData.track.forEach((track, idx) => {
    // トラックにどんなメタイベントがあるか全部出す
    track.event.forEach(ev => {
      if (ev.type === MIDI_EVENT_TYPE_META) {
        console.log(`[Debug] Track ${idx} MetaEvent: type=${ev.metaType}`);
      }
      
      if (ev.type === MIDI_EVENT_TYPE_META && ev.metaType === MIDI_META_TIME_SIGNATURE) {
        timeSig.n = ev.data[0];
        timeSig.d = Math.pow(2, ev.data[1]);
      }
    });
  });
  return timeSig;
};

/**
 * MIDIの解像度（1拍あたりのTick数）を抽出する
 */
export const extractResolution = (midiData) => {
  // midi-parser-js の構造では通常 timeDivision に入っている
  return midiData.timeDivision || 480; 
};

/**
 * MIDIデータからテンポ（BPM）を抽出する関数
 * @param {object} midiData - パース済みMIDIデータ
 * @returns {number} テンポ（BPM）
 */
export const extractTempo = (midiData) => {
  let bpm = 120; 
  midiData.track.forEach(track => {
    track.event.forEach(ev => {
      if (ev.type === MIDI_EVENT_TYPE_META && ev.metaType === MIDI_META_TEMPO) {
        let msPerBeat;

        // dataが数値として直接入っている場合
        if (typeof ev.data === 'number') {
          msPerBeat = ev.data;
        } 
        // 3バイトの配列として入っている場合
        else if (Array.isArray(ev.data) || ev.data instanceof Uint8Array) {
          msPerBeat = (ev.data[0] << 16) + (ev.data[1] << 8) + ev.data[2];
        }

        if (msPerBeat > 0) {
          bpm = Math.round(60000000 / msPerBeat);
        }
      }
    });
  });
  return bpm;
};

/**
 * 各トラックを解析し、メロディ/コード判定を行う関数
 * @param {object} midiData - パース済みMIDIデータ
 * @returns {Array<{index: number, notes: Array, isChord: boolean}>} 解析結果配列
 */
export const analyzeTracks = (midiData) => {
  const musicTracks = [];
  midiData.track.forEach((track, idx) => {
    let absoluteTick = 0;
    const notes = [];
    track.event.forEach(ev => {
      absoluteTick += ev.deltaTime;
      if (ev.type === MIDI_EVENT_NOTE_ON && ev.data && ev.data[1] > 0) {
        notes.push({ tick: absoluteTick, note: ev.data[0], velocity: ev.data[1] });
      }
    });

    if (notes.length > 0) {
      const hasChord = notes.some((n, i) => i > 0 && n.tick === notes[i - 1].tick);
      musicTracks.push({
        index: idx,
        notes: notes,
        isChord: hasChord
      });
    }
  });
  return musicTracks;
};

/**
 * トラックのノート配列をABC記法の文字列に変換する
 * @param {Array} notes - analyzeTracksで抽出したノート配列
 * @param {number} resolution - MIDIの解像度(PPQ)
 * @returns {string} ABC記法の音符列
 */
export const convertTrackToAbc = (notes, resolution) => {
  if (!notes || notes.length === 0) return "";

  let abcString = "";
  const baseTick = resolution / 2; // L:1/8（8分音符）を基準とするための単位Tick

  notes.forEach((note, i) => {
    // 1. 音名を変換 (例: 60 -> C)
    const name = getNoteName(note.note);

    // 2. 音の長さを計算 (Note Offまでの時間を想定)
    // ※現在は簡易的に「次の音までの間隔」を長さとして扱います
    // 本来はNote Offイベントを見るべきですが、まずはこれで「ドレミ」が繋がります
    let durationTicks = 0;
    if (i < notes.length - 1) {
      durationTicks = notes[i + 1].tick - note.tick;
    } else {
      durationTicks = resolution; // 最後の音はとりあえず4分音符分
    }

    // 3. ABCの長さに変換 (例: 480 / 240 = 2)
    let length = Math.round(durationTicks / baseTick);
    
    // 長さが1の場合は数字を省略するのがABCのルール
    const lengthStr = length <= 1 ? "" : length.toString();

    abcString += name + lengthStr + " ";
    
    // 8個（2小節分程度）ごとに改行を入れると見やすい
    if ((i + 1) % 8 === 0) abcString += "\n";
  });

  return abcString;
};

// --- UI操作部分（テスト環境では実行させない） ---
// typeof document !== 'undefined' で囲むことで、テスト実行時のエラーを防ぎます
if (typeof document !== 'undefined') {
  const fileInput = document.getElementById('file');
  const output = document.getElementById('output');
  const abcResult = document.getElementById('abc-result');
  const abcSection = document.getElementById('abcSection');

  if (!fileInput || !output || !abcResult || !abcSection) {
    // UI要素が取得できなかった場合のエラー表示
    if (output) {
      output.style.color = 'red';
      output.textContent = 'UI要素の取得に失敗しました。HTML構造を確認してください。';
    } else {
      // output自体がnullの場合はalertで通知
      alert('UI要素の取得に失敗しました。HTML構造を確認してください。');
    }
  } else {
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      output.textContent = '解析中...';
      output.style.color = 'black';

      try {
        const arrayBuffer = await file.arrayBuffer();
        const midiData = MidiParser.parse(new Uint8Array(arrayBuffer));

        // --- 切り出したロジックを呼び出す ---
        const timeSig = extractTimeSignature(midiData);
        const bpm = extractTempo(midiData);
        const resolution = extractResolution(midiData);
        const musicTracks = analyzeTracks(midiData);

        // バリデーション処理
        let debugLog = `【デバッグ情報: ${file.name}】\n`;
        let errors = [];
        const chordTracks = musicTracks.filter(t => t.isChord);
        const melodyTracks = musicTracks.filter(t => !t.isChord);

        musicTracks.forEach(t => {
          debugLog += `Track ${t.index}: ${t.isChord ? 'コード' : 'メロディ'}トラックとして判定\n`;
        });

        if (musicTracks.length > 2) errors.push(`トラック数が多すぎます (${musicTracks.length})`);
        if (chordTracks.length > 1) errors.push(`コードトラックが複数あります`);
        if (melodyTracks.length > 1) errors.push(`メロディトラックが複数あります`);

        // 画面への反映
        if (errors.length > 0) {
          output.style.color = 'red';
          output.textContent = debugLog + '\n【エラー】\n' + errors.join('\n');
          abcSection.style.display = 'none';
        } else {
          output.textContent = debugLog + '\n【チェックOK！】';
          const header = generateAbcHeader(file.name, timeSig, bpm);
          // メロディトラックを探して変換
          const melodyTrack = musicTracks.find(t => !t.isChord);
          let notesBody = "";
          if (melodyTrack) {
            notesBody = convertTrackToAbc(melodyTrack.notes, resolution);
          }
          abcResult.textContent = header + notesBody;
          abcSection.style.display = 'block';
        }

      } catch (err) {
        output.style.color = 'red';
        output.textContent = '解析エラー: ' + err.message;
      }
    };
  }
}