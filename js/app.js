// ABC SCORE ASSISTANT - 共通ロジック

// --- ロジック部分（テストしたい関数） ---
export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const generateAbcHeader = (fileName) => {
  const title = fileName.replace(/\.[^/.]+$/, ""); 
  return `X:1\nT:${title}\nM:4/4\nL:1/8\nK:C\n`;
};

export const getNoteName = (midiNumber) => {
  const name = NOTE_NAMES[midiNumber % 12];
  const octave = Math.floor(midiNumber / 12) - 1;
  return `${name}${octave}`;
};

// --- UI操作部分（テスト環境では実行させない） ---
// typeof document !== 'undefined' で囲むことで、テスト実行時のエラーを防ぎます
if (typeof document !== 'undefined') {

  const showMidiUpload = () => {
    const section = document.getElementById('midiUploadSection')
    if (!section) return
    section.classList.remove('hidden')
    section.scrollIntoView({ behavior: 'smooth' })
  }

  document.getElementById('startMidiConvert')?.addEventListener('click', showMidiUpload)

  document.getElementById('file').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const output = document.getElementById('output');
    const abcResult = document.getElementById('abc-result');
    const abcSection = document.getElementById('abcSection');
    
    output.textContent = '解析中...';
    output.style.color = 'black';
    abcResult.textContent = '';
    abcSection.style.display = 'none';

    try {
      const arrayBuffer = await file.arrayBuffer();
      const midiData = MidiParser.parse(new Uint8Array(arrayBuffer));

      let musicTracks = [];

      midiData.track.forEach((track, idx) => {
        let absoluteTick = 0;
        let notesInTrack = [];

        track.event.forEach(ev => {
          absoluteTick += ev.deltaTime;
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
        const ticks = t.notes.map(n => n.tick);
        const hasChord = ticks.some((tick, i) => i > 0 && tick === ticks[i - 1]);

        if (hasChord) {
          chordTrackCount++;
          debugLog += `Track ${t.index}: コードトラックとして判定\n`;
        } else {
          melodyTrackCount++;
          debugLog += `Track ${t.index}: メロディトラックとして判定\n`;
        }
      });

      if (musicTracks.length > 2) errors.push(`トラック数が多すぎます (${musicTracks.length})`);
      if (chordTrackCount > 1) errors.push(`コードトラックが複数あります`);
      if (melodyTrackCount > 1) errors.push(`メロディトラックが複数あります`);

      if (errors.length > 0) {
        output.style.color = 'red';
        output.textContent = debugLog + '\n【エラー】\n' + errors.join('\n');
      } else {
        output.style.color = 'black';
        output.textContent = debugLog + '\n【チェックOK！】';
        
        if (abcResult && abcSection) {
            const header = generateAbcHeader(file.name);
            abcResult.textContent = header + "\n% ここに音符の変換結果が続きます...";
            abcSection.style.display = 'block';
        }
      }

    } catch (err) {
      output.style.color = 'red';
      output.textContent = '解析エラー: ' + err.message;
      console.error(err);
    }
  };
}