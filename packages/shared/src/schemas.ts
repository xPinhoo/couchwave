import { z } from 'zod';
import { PLAYER_NAME_MAX_LENGTH, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './constants.js';
import {
  DRAW_COLORS,
  DRAW_COORD_MAX,
  DRAW_ROUNDS_OPTIONS,
  DRAW_SECONDS_OPTIONS,
  DRAW_SIZES,
  DRAW_WORD_CHOICES,
  GUESS_MAX_LENGTH,
  STROKE_CHUNK_MAX,
} from './draw.js';
import {
  TRIVIA_CHOICES,
  TRIVIA_LENGTH_OPTIONS,
  TRIVIA_SECONDS_OPTIONS,
  TRIVIA_TOPICS,
  type TriviaTopic,
} from './games.js';
import { AVATAR_PHOTO_MAX_CHARS, AVATAR_PRESETS, REACTIONS } from './lobby.js';

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

const presetIds = AVATAR_PRESETS.map((preset) => preset.id) as [
  (typeof AVATAR_PRESETS)[number]['id'],
  ...(typeof AVATAR_PRESETS)[number]['id'][],
];

export const avatarSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('preset'), id: z.enum(presetIds) }),
  z.object({
    kind: z.literal('photo'),
    // Raster images only: an SVG data URL could carry script
    dataUrl: z
      .string()
      .max(AVATAR_PHOTO_MAX_CHARS, 'Photo is too large')
      .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/, 'Invalid photo'),
  }),
]);

export const joinRoomSchema = z.object({
  roomCode: roomCodeSchema,
  name: playerNameSchema,
  /** Optional so older clients still work; the server picks a preset when it's missing. */
  avatar: avatarSchema.optional(),
});

export type JoinRoomPayload = z.input<typeof joinRoomSchema>;

const tokenSchema = z.string().min(1).max(128);

export const rejoinRoomSchema = z.object({
  sessionToken: tokenSchema,
});

export type RejoinRoomPayload = z.input<typeof rejoinRoomSchema>;

export const resumeScreenSchema = z.object({
  screenToken: tokenSchema,
});

export type ResumeScreenPayload = z.input<typeof resumeScreenSchema>;

export const answerSchema = z.object({
  choice: z
    .number()
    .int()
    .min(0)
    .max(TRIVIA_CHOICES - 1),
});

export type AnswerPayload = z.input<typeof answerSchema>;

export const kickPlayerSchema = z.object({
  playerId: z.string().min(1).max(64),
});

export type KickPlayerPayload = z.input<typeof kickPlayerSchema>;

export const reactSchema = z.object({
  emoji: z.enum(REACTIONS),
});

export type ReactPayload = z.input<typeof reactSchema>;

export const libraryMoveSchema = z.object({
  delta: z.union([z.literal(-1), z.literal(1)]),
});

export type LibraryMovePayload = z.input<typeof libraryMoveSchema>;

const topicIds = TRIVIA_TOPICS.map((topic) => topic.id) as [TriviaTopic, ...TriviaTopic[]];
const oneOf = <T extends number>(values: readonly T[]) =>
  z.number().refine((n): n is T => (values as readonly number[]).includes(n), 'Not an option');

export const triviaOptionsSchema = z.object({
  topic: z.enum(topicIds),
  secondsPerQuestion: oneOf(TRIVIA_SECONDS_OPTIONS),
  questionCount: oneOf(TRIVIA_LENGTH_OPTIONS),
});

export const readySchema = z.object({
  ready: z.boolean(),
});

export type ReadyPayload = z.input<typeof readySchema>;

export const drawOptionsSchema = z.object({
  secondsToDraw: oneOf(DRAW_SECONDS_OPTIONS),
  rounds: oneOf(DRAW_ROUNDS_OPTIONS),
});

export const chooseWordSchema = z.object({
  index: z
    .number()
    .int()
    .min(0)
    .max(DRAW_WORD_CHOICES - 1),
});

export type ChooseWordPayload = z.input<typeof chooseWordSchema>;

export const strokeSchema = z.object({
  id: z.number().int().min(0).max(1_000_000),
  color: z
    .number()
    .int()
    .min(0)
    .max(DRAW_COLORS.length - 1),
  size: z
    .number()
    .int()
    .min(0)
    .max(DRAW_SIZES.length - 1),
  points: z
    .array(z.number().int().min(0).max(DRAW_COORD_MAX))
    .min(2)
    .max(STROKE_CHUNK_MAX)
    .refine((points) => points.length % 2 === 0, 'Points come in x, y pairs'),
});

export const guessSchema = z.object({
  text: z.string().trim().min(1).max(GUESS_MAX_LENGTH),
});

export type GuessPayload = z.input<typeof guessSchema>;
