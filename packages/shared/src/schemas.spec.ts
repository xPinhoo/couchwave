import { describe, expect, it } from 'vitest';
import { joinRoomSchema, playerNameSchema, roomCodeSchema } from './schemas.js';

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

describe('joinRoomSchema', () => {
  it('parses a valid payload', () => {
    expect(joinRoomSchema.parse({ roomCode: 'wxyz', name: 'Rui' })).toEqual({
      roomCode: 'WXYZ',
      name: 'Rui',
    });
  });
});
