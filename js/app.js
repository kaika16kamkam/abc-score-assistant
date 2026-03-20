// ABC SCORE ASSISTANT - 共通ロジック

// --- ロジック部分（テストしたい関数） ---
export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const generateAbcHeader = (fileName, timeSig = { n: 4, d: 4 }, bpm = 120) => {
  const title = fileName.replace(/\.[^/.]+$/, "");
  return `X:1\nT:${title}\nM:${timeSig.n}/${timeSig.d}\nL:1/8\nQ:${bpm}\nK:C\n`;
};

export const getNoteName = (midiNumber) => {
  const name = NOTE_NAMES[midiNumber % 12];
  const octave = Math.floor(midiNumber / 12) - 1;
  return `${name}${octave}`;
};

// 拍子を抽出するだけの関数
export const extractTimeSignature = (midiData) => {
  let timeSig = { n: 4, d: 4 };
  
  midiData.track.forEach((track, idx) => {
    // トラックにどんなメタイベントがあるか全部出す
    track.event.forEach(ev => {
      if (ev.type === 255) {
        console.log(`[Debug] Track ${idx} MetaEvent: type=${ev.metaType}`);
      }
      
      if (ev.type === 255 && ev.metaType === 88) {
        timeSig.n = ev.data[0];
        timeSig.d = Math.pow(2, ev.data[1]);
      }
    });
  });
  return timeSig;
};

export const extractTempo = (midiData) => {
  let bpm = 120; 
  midiData.track.forEach(track => {
    track.event.forEach(ev => {
      if (ev.type === 255 && ev.metaType === 81) {
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

// トラックを解析して「メロディかコードか」を判定するだけの関数
export const analyzeTracks = (midiData) => {
  let musicTracks = [];
  midiData.track.forEach((track, idx) => {
    let absoluteTick = 0;
    let notes = [];
    track.event.forEach(ev => {
      absoluteTick += ev.deltaTime;
      if (ev.type === 9 && ev.data && ev.data[1] > 0) {
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

// --- UI操作部分（テスト環境では実行させない） ---
// typeof document !== 'undefined' で囲むことで、テスト実行時のエラーを防ぎます
if (typeof document !== 'undefined') {
  const fileInput = document.getElementById('file');
  const output = document.getElementById('output');
  const abcResult = document.getElementById('abc-result');
  const abcSection = document.getElementById('abcSection');

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
        abcResult.textContent = header + "\n% ここに音符の変換結果が続きます...";
        abcSection.style.display = 'block';
      }

    } catch (err) {
      output.style.color = 'red';
      output.textContent = '解析エラー: ' + err.message;
    }
  };
}