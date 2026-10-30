import { describe, expect, it } from 'vitest';
import { AVATAR_ART } from './avatar-art.js';
import {
  AVATAR_PRESETS,
  GAMES,
  avatarArtUrl,
  libraryPosition,
  moveInLibrary,
  presetAvatar,
} from './lobby.js';

describe('avatar presets', () => {
  it('have unique ids', () => {
    const ids = AVATAR_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('use every drawing in assets/profile-avatars', () => {
    expect(AVATAR_PRESETS.map((preset) => preset.id).sort()).toEqual(
      Object.keys(AVATAR_ART).sort(),
    );
  });

  it.each(Object.entries(AVATAR_ART))('%s is an SVG a browser will show as an image', (_, art) => {
    expect(art).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 512 512"/);
    expect(art).not.toMatch(/<script|\son\w+=|href=/i);
    // Only the <svg> tag loses its fixed size: a <rect> without one isn't drawn
    expect(art).not.toMatch(/<rect(?![^>]*\swidth=)[^>]*>/);
  });

  it('turns a drawing into a data URL', () => {
    expect(avatarArtUrl(presetAvatar('nerd'))).toMatch(
      /^data:image\/svg\+xml;charset=utf-8,%3Csvg/,
    );
  });

  it('shows unknown ids, like removed presets, as the anonymous silhouette', () => {
    expect(presetAvatar('fox').id).toBe('anonymous');
  });
});

describe('moving in the library', () => {
  const at = (id: string) => GAMES.findIndex((game) => game.id === id);

  it('knows which tab and which card a game is', () => {
    expect(libraryPosition(at('bluff'))).toEqual({
      categoryIndex: 1,
      games: [at('draw'), at('bluff')],
      gameIndex: 1,
    });
  });

  it('stops at the ends instead of wrapping around', () => {
    expect(moveInLibrary(at('trivia'), 'game', 1)).toBe(at('trivia'));
    expect(moveInLibrary(at('trivia'), 'category', -1)).toBe(at('trivia'));
    expect(moveInLibrary(at('trivia'), 'category', 1)).toBe(at('draw'));
    expect(moveInLibrary(at('draw'), 'game', 1)).toBe(at('bluff'));
  });
});
