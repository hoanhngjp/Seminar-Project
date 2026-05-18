import { describe, it, expect } from 'vitest';
import { slugify, songUrl } from '../../utils/slugify';

describe('slugify', () => {
  it('converts ASCII title to lowercase hyphenated slug', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('removes Vietnamese diacritics', () => {
    expect(slugify('Lạc Trôi')).toBe('lac-troi');
  });

  it('converts đ to d', () => {
    expect(slugify('Đường Về Nhà')).toBe('duong-ve-nha');
  });

  it('removes special characters', () => {
    expect(slugify('Hello! World?')).toBe('hello-world');
  });

  it('collapses multiple spaces into single hyphen', () => {
    expect(slugify('hello   world')).toBe('hello-world');
  });

  it('trims leading and trailing whitespace', () => {
    expect(slugify('  hello  ')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('handles full Vietnamese song title', () => {
    const result = slugify('Muộn Rồi Mà Sao Còn');
    expect(result).toBe('muon-roi-ma-sao-con');
  });

  it('handles mixed case', () => {
    expect(slugify('SƠN TÙNG M-TP')).toBe('son-tung-m-tp');
  });
});

describe('songUrl', () => {
  it('returns /songs/{slug}?id={id}', () => {
    const url = songUrl({ id: 'abc-123', title: 'Lạc Trôi' });
    expect(url).toBe('/songs/lac-troi?id=abc-123');
  });

  it('path segment is slug, not UUID', () => {
    const url = songUrl({ id: 'uuid-xyz', title: 'Chuyến Xe' });
    expect(url.split('?')[0]).toBe('/songs/chuyen-xe');
  });

  it('ID is preserved exactly in query param', () => {
    const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const url = songUrl({ id, title: 'Test Song' });
    expect(url).toContain(`?id=${id}`);
  });
});
