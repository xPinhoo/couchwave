import { describe, expect, it } from 'vitest';
import { AVATAR_PHOTO_MAX_CHARS } from './lobby.js';
import { avatarSchema, joinRoomSchema, playerNameSchema, roomCodeSchema } from './schemas.js';

describe('roomCodeSchema', () => {
  it('normalises case and whitespace', () => {
    expect(roomCodeSchema.parse('  abcd ')).toBe('ABCD');
  });

  it.each(['ABC', 'ABCDE', 'AB1D', 'ABOI'])('rejects %s', (code) => {
    expect(roomCodeSchema.safeParse(code).success).toBe(false);
  });
});

describe('playerNameSchema', () => {
  it('trims the name', () => {
    expect(playerNameSchema.parse('  Ana ')).toBe('Ana');
  });

  it('rejects empty and too-long names', () => {
    expect(playerNameSchema.safeParse('   ').success).toBe(false);
    expect(playerNameSchema.safeParse('x'.repeat(17)).success).toBe(false);
  });
});

describe('avatarSchema', () => {
  const photo = (dataUrl: string) => avatarSchema.safeParse({ kind: 'photo', dataUrl }).success;

  it('accepts presets from the list only', () => {
    expect(avatarSchema.safeParse({ kind: 'preset', id: 'happy-bot' }).success).toBe(true);
    expect(avatarSchema.safeParse({ kind: 'preset', id: 'dragon' }).success).toBe(false);
  });

  it('accepts small raster photos', () => {
    expect(photo('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe(true);
    expect(photo('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
  });

  it('rejects SVG, remote URLs and oversized photos', () => {
    expect(photo('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(photo('https://example.com/me.jpg')).toBe(false);
    expect(photo(`data:image/jpeg;base64,${'A'.repeat(AVATAR_PHOTO_MAX_CHARS)}`)).toBe(false);
  });
});

describe('joinRoomSchema', () => {
  it('parses a valid payload', () => {
    expect(joinRoomSchema.parse({ roomCode: 'wxyz', name: 'Rui' })).toEqual({
      roomCode: 'WXYZ',
      name: 'Rui',
    });
  });
});
