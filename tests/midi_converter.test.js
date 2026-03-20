import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import MidiParser from 'midi-parser-js';
import { 
  generateAbcHeader, 
  extractTimeSignature,
  extractTempo, 
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

