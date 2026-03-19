// ABC SCORE ASSISTANT - 共通ロジック

const showMidiUpload = () => {
  const section = document.getElementById('midiUploadSection')
  if (!section) return
  section.classList.remove('hidden')
  section.scrollIntoView({ behavior: 'smooth' })
}

document.getElementById('startMidiConvert')?.addEventListener('click', showMidiUpload)

document.getElementById('file').onchange = async (e) => {
  const file = e.target.files[0]
  if (!file) return

  try {
    const arrayBuffer = await file.arrayBuffer()
    document.getElementById('output').textContent =
      '読み込み成功: ' + file.name + '\n\n（ここにABC変換結果が表示されます）'
  } catch (err) {
    document.getElementById('output').textContent =
      'エラー: ' + err.message
  }
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// MIDI番号を「ドレミ」に変換する関数
const getNoteName = (midiNumber) => {
  const name = NOTE_NAMES[midiNumber % 12];
  const octave = Math.floor(midiNumber / 12) - 1;
  return `${name}${octave}`;
};

// 和音判定とデバッグ表示を含むメイン処理
document.getElementById('file').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const output = document.getElementById('output');
  output.textContent = '解析中...';

  try {
    const arrayBuffer = await file.arrayBuffer();
    const midiData = MidiParser.parse(new Uint8Array(arrayBuffer));

    let musicTracks = [];

    midiData.track.forEach((track, idx) => {
      let absoluteTick = 0; // 曲の開始からの累積時間
      let notesInTrack = [];

      track.event.forEach(ev => {
        absoluteTick += ev.deltaTime; // 時間を積み上げていく

        // Note On (type 9) かつ ベロシティが0より大きいものを抽出
        if (ev.type === 9 && ev.data && ev.data[1] > 0) {
          notesInTrack.push({
            tick: absoluteTick,
            note: ev.data[0],
            velocity: ev.data[1]
          });
        }
      });

      if (notesInTrack.length > 0) {
        musicTracks.push({ index: idx, notes: notesInTrack });
      }
    });

    let debugLog = `【デバッグ情報: ${file.name}】\n`;
    let errors = [];
    let chordTrackCount = 0;
    let melodyTrackCount = 0;

    musicTracks.forEach(t => {
      // 絶対時間(tick)が重複している音があるかチェック
      const ticks = t.notes.map(n => n.tick);
      const hasChord = ticks.some((tick, i) => i > 0 && tick === ticks[i - 1]);

      if (hasChord) {
        chordTrackCount++;
        debugLog += `Track ${t.index}: 和音を検出しました (Chord)\n`;
        // 重複している箇所のサンプルを表示
        const conflict = t.notes.find((n, i) => i > 0 && n.tick === t.notes[i-1].tick);
        debugLog += `  -> 重複例: Tick ${conflict.tick} で複数の音が重なっています\n`;
      } else {
        melodyTrackCount++;
        debugLog += `Track ${t.index}: 単音のみです (Melody)\n`;
      }
    });

    // 要件バリデーション
    if (musicTracks.length > 2) errors.push(`トラック数が多すぎます (${musicTracks.length})`);
    if (chordTrackCount > 1) errors.push(`コードトラックが複数あります`);
    if (melodyTrackCount > 1) errors.push(`メロディトラックが複数あります`);

    if (errors.length > 0) {
      output.style.color = 'red';
      output.textContent = debugLog + '\n【エラー】\n' + errors.join('\n');
    } else {
      output.style.color = 'black';
      output.textContent = debugLog + '\n【チェックOK！】ABC変換に進めます。';
    }

  } catch (err) {
    output.textContent = '解析エラー: ' + err.message;
    console.error(err);
  }
};

// 和音が含まれているか判定する補助関数
function checkIfHasChord(notes) {
  // MIDIイベントのdeltaTimeが0の Note On が連続していれば和音
  // midi-parser-js では event.deltaTime を使用
  let chordFound = false;
  notes.forEach((note, i) => {
    // 2番目以降の音符で、前の音符との時間差(deltaTime)が0なら和音
    if (i > 0 && note.deltaTime === 0) {
      chordFound = true;
    }
  });
  return chordFound;
}
