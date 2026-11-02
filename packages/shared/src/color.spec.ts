import { describe, expect, it } from 'vitest';
import { hexToHsl, hslToHex } from './color.js';
import { COLOR_PUZZLES, colorArtUrl } from './colorArt.js';

describe('hslToHex and hexToHsl', () => {
  it('converts well-known colours', () => {
    expect(hslToHex({ h: 0, s: 100, l: 50 })).toBe('#ff0000');
    expect(hslToHex({ h: 120, s: 100, l: 50 })).toBe('#00ff00');
    expect(hslToHex({ h: 240, s: 100, l: 50 })).toBe('#0000ff');
    expect(hslToHex({ h: 0, s: 0, l: 100 })).toBe('#ffffff');
    expect(hexToHsl('#00ff00')).toEqual({ h: 120, s: 100, l: 50 });
  });

  it('survives the round trip', () => {
    for (const hex of ['#c0362c', '#1db954', '#fed90f', '#808080', '#351c15']) {
      expect(hslToHex(hexToHsl(hex))).toBe(hex);
    }
  });
});

describe('the Guess the Color pictures', () => {
  it('have unique ids, and all of them have somewhere to put the colour', () => {
    expect(new Set(COLOR_PUZZLES.map((puzzle) => puzzle.id)).size).toBe(COLOR_PUZZLES.length);
    for (const puzzle of COLOR_PUZZLES) expect(puzzle.art).toContain('__COLOR__');
  });

  it('fill the missing part with the colour, or a pattern while it is hidden', () => {
    const puzzle = COLOR_PUZZLES[0]!;
    const svg = (color: string | null) => decodeURIComponent(colorArtUrl(puzzle, color));
    expect(svg('#123456')).toContain('fill="#123456"');
    expect(svg(null)).toContain('fill="url(#hidden)"');
    expect(svg(null)).not.toContain('__COLOR__');
  });
});
