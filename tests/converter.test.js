import { describe, it, expect } from 'vitest'
import { generateAbcHeader, getNoteName } from '../js/app.js'

describe('ABC変換のテスト', () => {
  it('ノート番号 60 が C4 になること', () => {
    expect(getNoteName(60)).toBe('C4');
  });

  it('ヘッダーにファイル名がタイトルとして含まれること', () => {
    const header = generateAbcHeader('test_song.mid');
    expect(header).toContain('T:test_song');
  });
});