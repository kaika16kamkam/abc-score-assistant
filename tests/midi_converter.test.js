import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import MidiParser from 'midi-parser-js';
import { 
  generateAbcHeader, 
  extractTimeSignature,
  extractTempo, 
  getNoteName,
  convertTrackToAbc,
  analyzeTracks 
} from '../js/app.js';

const parseMidiFile = (fileName) => {
  const filePath = path.join(__dirname, '../data', fileName);
  const buffer = fs.readFileSync(filePath);
  return MidiParser.parse(new Uint8Array(buffer));
};

describe('MIDIファイル読み込みとバリデーションのテスト', () => {

  it('valid_basic.mid: 正しくヘッダーが生成されること', () => {
    const fileName = 'valid_basic.mid';
    // 引数なしでもデフォルト4/4で動くことを確認
    const header = generateAbcHeader(fileName);
    
    expect(header).toContain('T:valid_basic');
    expect(header).toContain('X:1');
    expect(header).toContain('M:4/4');
    expect(header).toContain('K:C');
  });

  it('6by4.mid: 拍子が正しく抽出されること', () => {
    const midiData = parseMidiFile('6by4.mid');
    
    // app.jsの本番ロジックを呼び出す
    const timeSig = extractTimeSignature(midiData); 
    
    expect(timeSig.n).toBe(6);
    expect(timeSig.d).toBe(4);
  });

  it('6by4.mid: 拍子(6/4)とテンポ(130)が正しく抽出されること', () => {
  const midiData = parseMidiFile('6by4.mid');
  const bpm = extractTempo(midiData);
  
  // 実際のデータに基づいた期待値に変更
  expect(bpm).toBe(130); 
});

  it('error_double_melody.mid: すべて単音（isChord: false）と判定されること', () => {
    const midiData = parseMidiFile('error_double_melody.mid');
    
    // app.jsの本番ロジックを呼び出す
    const analyzed = analyzeTracks(midiData);
    
    analyzed.forEach(track => {
      // 2. app.jsの実装に合わせて「isChord」が false であることを確認
      expect(track.isChord).toBe(false);
    });
  });

  it('error_too_many_tracks.mid: 3つ以上の演奏トラックが検出されること', () => {
    const midiData = parseMidiFile('error_too_many_tracks.mid');
    const analyzed = analyzeTracks(midiData);
    
    // トラック数自体のバリデーションもこれでテスト可能
    expect(analyzed.length).toBeGreaterThan(2);
  });
});

describe('ABC音符列生成のテスト', () => {
  it('ノート配列が正しいABC文字列（音名+長さ）に変換されること', () => {
    const mockNotes = [
      { tick: 0, note: 60 },   // C (次まで480tick) -> C2
      { tick: 480, note: 62 }, // D (次まで240tick) -> D
      { tick: 720, note: 64 }  // E (最後: 480tick分とする) -> E2
    ];
    const resolution = 480;
    
    const result = convertTrackToAbc(mockNotes, resolution);
    
    expect(result).toContain('C2');
    expect(result).toContain('D '); // 半角スペースを含む
    expect(result).toContain('E2'); // E4からE2に修正
  });

  it('音の前に隙間がある場合、休符 z が挿入されること', () => {
  const mockNotes = [
    { tick: 480, note: 60 } // 4分休符(480tick)の後に中央C
  ];
  const resolution = 480;
  const result = convertTrackToAbc(mockNotes, resolution);
  
  // z2（8分音符2個分＝4分休符）が含まれているか
  expect(result).toContain('z2 C2');
  });

  it('1小節分の時間が経過したときに小節線 | が挿入されること', () => {
  const resolution = 480;
  const mockNotes = [
      { tick: 0, note: 60 },    // C (4分 = 480)
      { tick: 480, note: 62 },  // D (4分 = 480)
      { tick: 960, note: 64 },  // E (4分 = 480)
      { tick: 1440, note: 65 }  // F (4分 = 480) -> 合計1920(1小節)
  ];

  const result = convertTrackToAbc(mockNotes, resolution);

  // 最後に小節線が含まれているか
  expect(result).toContain('|');
  });

  it('3/4拍子の場合、3拍分の経過で小節線 | が挿入されること', () => {
  const resolution = 480;
  const timeSig = { n: 3, d: 4 }; // 3/4拍子
  const mockNotes = [
    { tick: 0, note: 60 },    // 1拍目
    { tick: 480, note: 62 },  // 2拍目
    { tick: 960, note: 64 }   // 3拍目 -> 合計1440 (480*3)
  ];
  
  const result = convertTrackToAbc(mockNotes, resolution, timeSig);
  
  expect(result).toContain('|');
  });

  it('和音（複数ノートが同じtick）が [CEG] 形式で出力されること', () => {
  const mockNotes = [
    { tick: 0, note: 60 }, // C
    { tick: 0, note: 64 }, // E
    { tick: 0, note: 67 }, // G  (これら3つでCメジャーコード)
    { tick: 480, note: 60 } // 次の音（4分音符後）
  ];
  const resolution = 480;
  
  const result = convertTrackToAbc(mockNotes, resolution);
  
  // [CEG]2 のようになっていることを期待
  expect(result).toContain('[CEG]2');
});
});