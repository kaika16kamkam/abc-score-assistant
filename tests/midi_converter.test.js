import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
// MidiParser (外部ライブラリ) のインポートを削除し、自前の parseMidiBinary を使用
import { 
  generateAbcHeader, 
  extractTimeSignature,
  extractTempo, 
  getNoteName,
  convertTrackToAbc,
  analyzeTracks,
  parseMidiBinary // 追加
} from '../js/app.js';

/**
 * app.js のロジックを使ってファイルをパースするヘルパー
 */
const parseMidiFile = (fileName) => {
  const filePath = path.join(__dirname, '../data', fileName);
  const buffer = fs.readFileSync(filePath);
  // ブラウザ環境と同様、Uint8Array を parseMidiBinary に渡す
  return parseMidiBinary(new Uint8Array(buffer));
};

describe('MIDIファイル読み込みとバリデーションのテスト', () => {

  it('valid_basic.mid: 正しくヘッダーが生成されること', () => {
    const fileName = 'valid_basic.mid';
    const header = generateAbcHeader(fileName);
    
    expect(header).toContain('T:valid_basic');
    expect(header).toContain('X:1');
    expect(header).toContain('M:4/4');
    expect(header).toContain('K:C');
  });

  it('6by4.mid: 拍子が正しく抽出されること', () => {
    const midiData = parseMidiFile('6by4.mid');
    const timeSig = extractTimeSignature(midiData); 
    
    expect(timeSig.n).toBe(6);
    expect(timeSig.d).toBe(4);
  });

  it('6by4.mid: 拍子(6/4)とテンポ(130)が正しく抽出されること', () => {
    const midiData = parseMidiFile('6by4.mid');
    const bpm = extractTempo(midiData);
    
    expect(bpm).toBe(130); 
  });

  it('error_double_melody.mid: すべて単音（isChord: false）と判定されること', () => {
    const midiData = parseMidiFile('error_double_melody.mid');
    // すでに parseMidiBinary でパース済みなので、そのまま analyzeTracks へ
    const analyzed = analyzeTracks(midiData);
    
    analyzed.forEach(track => {
      expect(track.isChord).toBe(false);
    });
  });

  it('error_too_many_tracks.mid: 3つ以上の演奏トラックが検出されること', () => {
    const midiData = parseMidiFile('error_too_many_tracks.mid');
    const analyzed = analyzeTracks(midiData);
    
    // MIDIファイル自体のトラック数を確認（空トラック含む場合があるため）
    expect(analyzed.length).toBeGreaterThanOrEqual(3);
  });

  it('logic.mid: 音符が含まれない空トラック（Track 0）が除外対象として識別できること', () => {
    const midiData = parseMidiFile('logic.mid');
    const analyzed = analyzeTracks(midiData);

    // 全トラックのうち、音符が1つ以上あるトラックのみを抽出
    const validTracks = analyzed.filter(track => track.notes.length > 0);

    // 今回のケースでは Track 0 が 0音、残り2つに音がある想定
    expect(analyzed[0].notes.length).toBe(0);
    expect(validTracks.length).toBe(2); 

    // 有効なトラックがすべて正しく解析されていること
    validTracks.forEach(track => {
      expect(track.notes.length).toBeGreaterThan(0);
    });
  });

  it('空トラックを除外してABC変換した際、V:1 が空にならないこと', () => {
    const midiData = parseMidiFile('logic.mid');
    const resolution = midiData[0].resolution;
    
    // 音符があるトラックだけを抽出
    const validTracks = analyzeTracks(midiData).filter(t => t.notes.length > 0);
    
    // 最初の有効なトラック（今回の MIDI では実質的な Track 1）を変換
    const abc = convertTrackToAbc(validTracks[0].notes, resolution);
    
    // ABC文字列が空（z8 | のような休符のみ、または完全に空）でないことを確認
    // 少なくとも音名が含まれているはず
    expect(abc).toMatch(/[A-Ga-g]/); 
  });
});

describe('ABC音符列生成のテスト', () => {
  // --- (ここは mockNotes を使っているので変更なし) ---
  it('ノート配列が正しいABC文字列（音名+長さ）に変換されること', () => {
    const mockNotes = [
      { tick: 0, note: 60 }, 
      { tick: 480, note: 62 },
      { tick: 720, note: 64 }
    ];
    const resolution = 480;
    const result = convertTrackToAbc(mockNotes, resolution);
    
    expect(result).toContain('C2');
    expect(result).toContain('D '); 
    expect(result).toContain('E2');
  });

  it('音の前に隙間がある場合、休符 z が挿入されること', () => {
    const mockNotes = [
      { tick: 480, note: 60 }
    ];
    const resolution = 480;
    const result = convertTrackToAbc(mockNotes, resolution);
    expect(result).toContain('z2 C2');
  });

  it('1小節分の時間が経過したときに小節線 | が挿入されること', () => {
    const resolution = 480;
    const mockNotes = [
        { tick: 0, note: 60 },    
        { tick: 480, note: 62 },  
        { tick: 960, note: 64 },  
        { tick: 1440, note: 65 }  
    ];
    const result = convertTrackToAbc(mockNotes, resolution);
    expect(result).toContain('|');
  });

  it('3/4拍子の場合、3拍分の経過で小節線 | が挿入されること', () => {
    const resolution = 480;
    const timeSig = { n: 3, d: 4 }; 
    const mockNotes = [
      { tick: 0, note: 60 },    
      { tick: 480, note: 62 },  
      { tick: 960, note: 64 }   
    ];
    const result = convertTrackToAbc(mockNotes, resolution, timeSig);
    expect(result).toContain('|');
  });

  it('和音（複数ノートが同じtick）が [CEG] 形式で出力されること', () => {
    const mockNotes = [
      { tick: 0, note: 60 }, 
      { tick: 0, note: 64 }, 
      { tick: 0, note: 67 }, 
      { tick: 480, note: 60 } 
    ];
    const resolution = 480;
    const result = convertTrackToAbc(mockNotes, resolution);
    expect(result).toContain('[CEG]2');
  });
});