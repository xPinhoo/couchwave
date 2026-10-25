import { z } from 'zod';
import { PLAYER_NAME_MAX_LENGTH, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './constants.js';

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`), 'Invalid room code');

export const playerNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(PLAYER_NAME_MAX_LENGTH, `Name must be at most ${PLAYER_NAME_MAX_LENGTH} characters`);

export const joinRoomSchema = z.object({
  roomCode: roomCodeSchema,
  name: playerNameSchema,
});

export type JoinRoomPayload = z.input<typeof joinRoomSchema>;

export const rejoinRoomSchema = z.object({
  sessionToken: z.string().min(1).max(128),
});

export type RejoinRoomPayload = z.input<typeof rejoinRoomSchema>;
