import {
  DRAW_WORDS,
  PHONE_PHRASES,
  QUESTION_BANKS,
  draw,
  phone,
  pickQuestions,
  planChains,
  planTurns,
  shuffle,
  trivia,
  type DrawState,
  type PhoneInput,
  type PhoneState,
  type TriviaState,
} from '@couchwave/engine';
import type { GameSetup, HostView, PlayerView, Stroke } from '@couchwave/shared';
import { Inject, Injectable } from '@nestjs/common';
import {
  DRAW_CHOOSE_SECONDS,
  GAME_CONFIG,
  PHONE_GUESS_SECONDS,
  PHONE_WRITE_SECONDS,
  TRIVIA_COUNTDOWN_SECONDS,
  type GameConfig,
} from './rooms.constants.js';

/** A game in progress. Draw & Guess also keeps the drawing of the current turn. */
export type RunningGame =
  | { id: 'trivia'; state: TriviaState }
  | { id: 'draw'; state: DrawState; strokes: Stroke[]; pointCount: number }
  | { id: 'phone'; state: PhoneState };

/** Caps on one turn's drawing, so a misbehaving client can't fill the server's memory. */
export const MAX_STROKES_PER_TURN = 2_000;
export const MAX_POINTS_PER_TURN = 100_000;

export function hostView(game: RunningGame): HostView {
  switch (game.id) {
    case 'trivia':
      return trivia.hostView(game.state);
    case 'draw':
      return draw.hostView(game.state);
    case 'phone':
      return phone.hostView(game.state);
  }
}

export function playerView(game: RunningGame, playerId: string): PlayerView {
  switch (game.id) {
    case 'trivia':
      return trivia.playerView(game.state, playerId);
    case 'draw':
      return draw.playerView(game.state, playerId);
    case 'phone':
      return phone.playerView(game.state, playerId);
  }
}

export const isOver = (game: RunningGame): boolean => game.state.phase === 'finished';

export const minPlayers = (gameId: GameSetup['gameId']): number =>
  ({ trivia, draw, phone })[gameId].minPlayers;

/**
 * Holds the running game of each room. Methods that change a game return it only when
 * something changed, so callers know when to broadcast.
 */
@Injectable()
export class GamesService {
  private readonly games = new Map<string, RunningGame>();

  /** Overridable in tests for a deterministic question and word order. */
  random: () => number = Math.random;

  constructor(@Inject(GAME_CONFIG) private readonly config: GameConfig) {}

  start(roomCode: string, playerIds: string[], setup: GameSetup, now: number): RunningGame {
    const { msPerSecond, revealMs } = this.config;
    let game: RunningGame;

    if (setup.gameId === 'trivia') {
      const { topic, questionCount, secondsPerQuestion } = setup.options;
      const count = Math.min(questionCount, this.config.maxQuestions);
      const state = trivia.init(
        playerIds,
        {
          topic,
          questions: pickQuestions(QUESTION_BANKS[topic], count, this.random),
          questionMs: secondsPerQuestion * msPerSecond,
          revealMs,
          countdownMs: TRIVIA_COUNTDOWN_SECONDS * msPerSecond,
        },
        now,
      );
      game = { id: 'trivia', state };
    } else if (setup.gameId === 'phone') {
      const { secondsToDraw, language } = setup.options;
      const state = phone.init(
        playerIds,
        {
          order: planChains(playerIds, this.random),
          phrases: shuffle(PHONE_PHRASES[language], this.random),
          writeMs: PHONE_WRITE_SECONDS * msPerSecond,
          drawMs: secondsToDraw * msPerSecond,
          guessMs: PHONE_GUESS_SECONDS * msPerSecond,
          revealMs,
        },
        now,
      );
      game = { id: 'phone', state };
    } else {
      const { rounds, secondsToDraw } = setup.options;
      const state = draw.init(
        playerIds,
        {
          turns: planTurns(playerIds, rounds, DRAW_WORDS, this.random),
          chooseMs: DRAW_CHOOSE_SECONDS * msPerSecond,
          drawMs: secondsToDraw * msPerSecond,
          revealMs,
        },
        now,
      );
      game = { id: 'draw', state, strokes: [], pointCount: 0 };
    }

    this.games.set(roomCode, game);
    return game;
  }

  get(roomCode: string): RunningGame | undefined {
    return this.games.get(roomCode);
  }

  /** Trivia: a player's answer. */
  answer(roomCode: string, playerId: string, choice: number, now: number) {
    return this.update(roomCode, (game) =>
      game.id === 'trivia'
        ? { ...game, state: trivia.onInput(game.state, playerId, { choice }, now) }
        : game,
    );
  }

  /** Draw & Guess: the artist picks a word. */
  chooseWord(roomCode: string, playerId: string, index: number, now: number) {
    return this.updateDraw(roomCode, (state) =>
      draw.onInput(state, playerId, { type: 'choose', index }, now),
    );
  }

  /** Draw & Guess: someone's guess. */
  guess(roomCode: string, playerId: string, text: string, now: number) {
    return this.updateDraw(roomCode, (state) =>
      draw.onInput(state, playerId, { type: 'guess', text }, now),
    );
  }

  /** Drawing Phone: anything a player does. Returns the game only when something changed. */
  phoneInput(roomCode: string, playerId: string, input: PhoneInput, now: number) {
    return this.update(roomCode, (game) =>
      game.id === 'phone'
        ? { ...game, state: phone.onInput(game.state, playerId, input, now) }
        : game,
    );
  }

  tick(roomCode: string, now: number) {
    return this.update(roomCode, (game) => {
      switch (game.id) {
        case 'trivia':
          return { ...game, state: trivia.onTick(game.state, now) };
        case 'draw':
          return this.withDrawState(game, draw.onTick(game.state, now));
        case 'phone':
          return { ...game, state: phone.onTick(game.state, now) };
      }
    });
  }

  /**
   * Adds a stroke, or more points to the stroke the artist is drawing. Returns false when
   * it doesn't come from the artist while drawing, or the turn's drawing is full.
   */
  addStroke(roomCode: string, playerId: string, chunk: Stroke): boolean {
    const game = this.drawingBy(roomCode, playerId);
    if (!game) return false;
    if (game.pointCount + chunk.points.length > MAX_POINTS_PER_TURN) return false;

    const last = game.strokes.at(-1);
    if (last?.id === chunk.id) {
      if (last.color !== chunk.color || last.size !== chunk.size) return false;
      last.points.push(...chunk.points);
    } else {
      if (game.strokes.length >= MAX_STROKES_PER_TURN) return false;
      game.strokes.push({ ...chunk, points: [...chunk.points] });
    }
    game.pointCount += chunk.points.length;
    return true;
  }

  undoStroke(roomCode: string, playerId: string): boolean {
    const game = this.drawingBy(roomCode, playerId);
    const removed = game?.strokes.pop();
    if (!game || !removed) return false;
    game.pointCount -= removed.points.length;
    return true;
  }

  clearDrawing(roomCode: string, playerId: string): boolean {
    const game = this.drawingBy(roomCode, playerId);
    if (!game) return false;
    game.strokes = [];
    game.pointCount = 0;
    return true;
  }

  /** The current turn's drawing, for a TV that just came back. */
  strokes(roomCode: string): Stroke[] {
    const game = this.games.get(roomCode);
    return game?.id === 'draw' ? game.strokes : [];
  }

  stop(roomCode: string): void {
    this.games.delete(roomCode);
  }

  /** The room's Draw & Guess game, if `playerId` is the artist and it's time to draw. */
  private drawingBy(roomCode: string, playerId: string) {
    const game = this.games.get(roomCode);
    if (game?.id !== 'draw' || game.state.phase !== 'drawing') return undefined;
    return draw.playerView(game.state, playerId).isArtist ? game : undefined;
  }

  /** A new turn starts on a blank canvas. */
  private withDrawState(game: Extract<RunningGame, { id: 'draw' }>, state: DrawState) {
    if (state === game.state) return game;
    return state.turn === game.state.turn
      ? { ...game, state }
      : { ...game, state, strokes: [], pointCount: 0 };
  }

  private updateDraw(roomCode: string, change: (state: DrawState) => DrawState) {
    return this.update(roomCode, (game) =>
      game.id === 'draw' ? this.withDrawState(game, change(game.state)) : game,
    );
  }

  private update(
    roomCode: string,
    change: (game: RunningGame) => RunningGame,
  ): RunningGame | undefined {
    const game = this.games.get(roomCode);
    if (!game) return undefined;

    const next = change(game);
    if (next === game || next.state === game.state) return undefined;
    this.games.set(roomCode, next);
    return next;
  }
}
