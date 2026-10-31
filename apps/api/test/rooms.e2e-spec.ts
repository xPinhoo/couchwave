import type { AddressInfo } from 'node:net';
import {
  GAMES,
  INITIAL_LIBRARY_CURSOR,
  focusedGame,
  type LibraryDirection,
  type ClientToServerEvents,
  type DrawHostView,
  type DrawPlayerView,
  type GameUpdate,
  type PhoneHostView,
  type PhonePlayerView,
  type SketchOp,
  type ServerToClientEvents,
  type Stroke,
  type TriviaHostView,
  type TriviaPlayerView,
  type WerewolfHostView,
  type WerewolfPlayerView,
} from '@couchwave/shared';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { GAME_CONFIG, RECONNECT_GRACE_MS, SCREEN_GRACE_MS } from '../src/rooms/rooms.constants.js';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const GRACE_MS = 300;
const SCREEN_GRACE = 400;
const QUESTION_MS = 400;
const TEN_SECONDS = { topic: 'general', secondsPerQuestion: 10, questionCount: 10 } as const;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Rooms (e2e)', () => {
  let app: INestApplication;
  let url: string;
  const clients: Client[] = [];

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RECONNECT_GRACE_MS)
      .useValue(GRACE_MS)
      .overrideProvider(SCREEN_GRACE_MS)
      .useValue(SCREEN_GRACE)
      .overrideProvider(GAME_CONFIG)
      // A "second" lasts 40ms, so a 10s question takes 400ms; games are capped at 2 questions
      .useValue({ revealMs: 150, msPerSecond: 40, maxQuestions: 2 })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    url = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    for (const client of clients.splice(0)) client.disconnect();
    await app.close();
  });

  async function connect(): Promise<Client> {
    const client: Client = io(url, { transports: ['websocket'], forceNew: true });
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once('connect', resolve);
      client.once('connect_error', reject);
    });
    return client;
  }

  async function createRoom() {
    const host = await connect();
    const res = await host.emitWithAck('room:create');
    if (!res.ok) throw new Error(res.error);
    return { host, roomCode: res.data.lobby.roomCode, screenToken: res.data.screenToken };
  }

  async function joinAs(roomCode: string, name: string) {
    const client = await connect();
    const res = await client.emitWithAck('room:join', { roomCode, name });
    if (!res.ok) throw new Error(res.error);
    return { client, ...res.data };
  }

  /**
   * The leader opens the library, picks trivia, sets 10s questions and everyone readies up.
   * `others` are the other connected players, who must be ready too for the game to start.
   */
  async function startTrivia(leader: Client, others: Client[] = []) {
    const ok = { ok: true, data: null };
    expect(await leader.emitWithAck('library:open')).toEqual(ok);
    expect(await leader.emitWithAck('library:select')).toEqual(ok);
    expect(await leader.emitWithAck('setup:options', TEN_SECONDS)).toEqual(ok);
    for (const player of others) {
      expect(await player.emitWithAck('setup:ready', { ready: true })).toEqual(ok);
    }
    expect(await leader.emitWithAck('setup:ready', { ready: true })).toEqual(ok);
  }

  /** Presses buttons on the leader's remote in the games library, one after the other. */
  async function remote(leader: Client, ...buttons: (LibraryDirection | 'ok')[]) {
    for (const button of buttons) {
      const res =
        button === 'ok'
          ? await leader.emitWithAck('library:select')
          : await leader.emitWithAck('library:move', { direction: button });
      expect(res).toEqual({ ok: true, data: null });
    }
  }

  const next = <E extends keyof ServerToClientEvents>(client: Client, event: E) =>
    new Promise<Parameters<ServerToClientEvents[E]>[0]>((resolve) => {
      client.once(event, ((arg: Parameters<ServerToClientEvents[E]>[0]) => resolve(arg)) as never);
    });

  /**
   * Resolves with the first game update matching `match`, failing after `timeoutMs`.
   * `U` narrows the update to the game being tested.
   */
  function waitFor<U>(
    client: Client,
    event: 'game:host' | 'game:player',
    match: (update: U) => boolean,
    timeoutMs = 3_000,
  ): Promise<U> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`No matching ${event}`)), timeoutMs);
      const listener = (update: U) => {
        if (!match(update)) return;
        clearTimeout(timer);
        client.off(event, listener as never);
        resolve(update);
      };
      client.on(event, listener as never);
    });
  }

  it('GET /health', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', commit: null });
  });

  it('the TV creates a room with a 4-letter code, an empty lobby and a screen token', async () => {
    const host = await connect();
    const res = await host.emitWithAck('room:create');

    expect(res).toMatchObject({
      ok: true,
      data: {
        lobby: {
          roomCode: expect.stringMatching(/^[A-Z]{4}$/),
          status: 'lobby',
          players: [],
          screenConnected: true,
        },
        screenToken: expect.any(String),
      },
    });
  });

  it('broadcasts the lobby to everyone in the room when players join', async () => {
    const { host, roomCode } = await createRoom();
    const ana = await connect();
    const rui = await connect();

    const hostSeesAna = next(host, 'lobby:update');
    await ana.emitWithAck('room:join', { roomCode: roomCode.toLowerCase(), name: 'Ana' });
    expect((await hostSeesAna).players.map((p) => p.name)).toEqual(['Ana']);

    const hostSeesRui = next(host, 'lobby:update');
    const anaSeesRui = next(ana, 'lobby:update');
    const res = await rui.emitWithAck('room:join', { roomCode, name: 'Rui' });

    expect(res.ok && res.data.lobby.players.map((p) => p.name)).toEqual(['Ana', 'Rui']);
    expect((await hostSeesRui).players).toHaveLength(2);
    expect((await anaSeesRui).players).toHaveLength(2);
  });

  it('rejects invalid payloads, unknown rooms and duplicate names', async () => {
    const { roomCode } = await createRoom();
    const ana = await connect();
    const other = await connect();

    expect(await ana.emitWithAck('room:join', { roomCode: '12', name: 'Ana' })).toMatchObject({
      ok: false,
      error: 'INVALID_PAYLOAD',
    });
    expect(await ana.emitWithAck('room:join', { roomCode: 'ZZZZ', name: 'Ana' })).toEqual({
      ok: false,
      error: 'ROOM_NOT_FOUND',
    });

    await ana.emitWithAck('room:join', { roomCode, name: 'Ana' });
    expect(await other.emitWithAck('room:join', { roomCode, name: 'ana' })).toEqual({
      ok: false,
      error: 'NAME_TAKEN',
    });
  });

  describe('avatars', () => {
    it('keeps the avatar each player picked, preset or photo, and shows it to everyone', async () => {
      const { host, roomCode } = await createRoom();
      const photo = { kind: 'photo', dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' } as const;

      const ana = await connect();
      await ana.emitWithAck('room:join', {
        roomCode,
        name: 'Ana',
        avatar: { kind: 'preset', id: 'pilot' },
      });
      const hostUpdate = next(host, 'lobby:update');
      const rui = await connect();
      await rui.emitWithAck('room:join', { roomCode, name: 'Rui', avatar: photo });

      expect((await hostUpdate).players.map((p) => p.avatar)).toEqual([
        { kind: 'preset', id: 'pilot' },
        photo,
      ]);
    });

    it('rejects avatars that are not a preset or a raster photo', async () => {
      const { roomCode } = await createRoom();
      const phone = await connect();

      for (const avatar of [
        { kind: 'preset', id: 'dragon' },
        { kind: 'photo', dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' },
      ]) {
        expect(
          await phone.emitWithAck('room:join', { roomCode, name: 'Ana', avatar } as never),
        ).toMatchObject({ ok: false, error: 'INVALID_PAYLOAD' });
      }
    });
  });

  describe('reactions', () => {
    it('float up on the TV, with a cooldown, and only outside games', async () => {
      const { host, roomCode } = await createRoom();
      const ana = await joinAs(roomCode, 'Ana');

      const onTv = next(host, 'room:reaction');
      expect(await ana.client.emitWithAck('room:react', { emoji: '🎉' })).toEqual({
        ok: true,
        data: null,
      });
      expect(await onTv).toEqual({ playerId: ana.playerId, emoji: '🎉' });

      expect(await ana.client.emitWithAck('room:react', { emoji: '🔥' })).toEqual({
        ok: false,
        error: 'TOO_FAST',
      });

      await sleep(350);
      await startTrivia(ana.client);
      expect(await ana.client.emitWithAck('room:react', { emoji: '🔥' })).toEqual({
        ok: false,
        error: 'WRONG_PHASE',
      });
    });

    it('rejects emoji that are not in the list', async () => {
      const { roomCode } = await createRoom();
      const ana = await joinAs(roomCode, 'Ana');
      expect(await ana.client.emitWithAck('room:react', { emoji: '🍕' } as never)).toEqual({
        ok: false,
        error: 'INVALID_PAYLOAD',
      });
    });
  });

  describe('games library', () => {
    it('is opened, browsed and closed by the leader, and everyone sees the highlight', async () => {
      const { host, roomCode } = await createRoom();
      const ana = await joinAs(roomCode, 'Ana');
      const rui = await joinAs(roomCode, 'Rui');

      expect(await rui.client.emitWithAck('library:open')).toEqual({
        ok: false,
        error: 'NOT_LEADER',
      });
      expect(await ana.client.emitWithAck('library:move', { direction: 'up' })).toEqual({
        ok: false,
        error: 'WRONG_PHASE',
      });

      const opened = next(host, 'lobby:update');
      const ruiSeesOpen = next(rui.client, 'lobby:update');
      await ana.client.emitWithAck('library:open');
      expect(await opened).toMatchObject({ status: 'library', library: INITIAL_LIBRARY_CURSOR });
      await ruiSeesOpen; // the broadcast can land after Ana's ack

      // Up to the tabs, right to Creative: it is focused, but only shown after OK
      const up = next(rui.client, 'lobby:update');
      await remote(ana.client, 'up');
      await up;
      const focused = next(rui.client, 'lobby:update');
      await remote(ana.client, 'right');
      expect((await focused).library).toEqual({ category: 0, focus: { area: 'tabs', index: 1 } });
      const shown = next(rui.client, 'lobby:update');
      await remote(ana.client, 'ok');
      expect((await shown).library.category).toBe(1);
      const moved = next(rui.client, 'lobby:update');
      await remote(ana.client, 'down');
      expect(GAMES[focusedGame((await moved).library)!]?.id).toBe('draw');

      const closed = next(host, 'lobby:update');
      expect(await ana.client.emitWithAck('library:close')).toEqual({ ok: true, data: null });
      expect((await closed).status).toBe('lobby');
    });

    it('lets players join while the leader is choosing', async () => {
      const { roomCode } = await createRoom();
      const ana = await joinAs(roomCode, 'Ana');
      await ana.client.emitWithAck('library:open');

      const rui = await joinAs(roomCode, 'Rui');
      expect(rui.lobby.status).toBe('library');
    });

    it('opens by itself when the third player joins, but only the first time', async () => {
      const { roomCode } = await createRoom();
      const ana = await joinAs(roomCode, 'Ana');
      expect((await joinAs(roomCode, 'Rui')).lobby.status).toBe('lobby');
      expect((await joinAs(roomCode, 'Eva')).lobby.status).toBe('library');

      // The leader goes back to wait for one more: the next player doesn't drag them out
      await ana.client.emitWithAck('library:close');
      expect((await joinAs(roomCode, 'Tom')).lobby.status).toBe('lobby');
    });

    it('refuses to start a game that is not available yet', async () => {
      const { roomCode } = await createRoom();
      const ana = await joinAs(roomCode, 'Ana');
      await ana.client.emitWithAck('library:open');
      await remote(ana.client, 'up', 'right', 'ok', 'down', 'right');
      const moved = next(ana.client, 'lobby:update');
      await remote(ana.client, 'right');

      const bluff = GAMES[focusedGame((await moved).library)!];
      expect(bluff?.id).toBe('bluff');
      expect(bluff?.available).toBe(false);
      expect(await ana.client.emitWithAck('library:select')).toEqual({
        ok: false,
        error: 'GAME_UNAVAILABLE',
      });
    });
  });

  describe('reconnection', () => {
    it('keeps a disconnected player seated, then frees the seat after the grace period', async () => {
      const { host, roomCode } = await createRoom();
      const ana = await joinAs(roomCode, 'Ana');

      const markedAway = next(host, 'lobby:update');
      ana.client.disconnect();
      expect((await markedAway).players).toMatchObject([
        { id: ana.playerId, name: 'Ana', connected: false },
      ]);

      const removed = next(host, 'lobby:update');
      expect((await removed).players).toEqual([]);
    });

    it('gives the same seat back when the player rejoins in time', async () => {
      const { host, roomCode } = await createRoom();
      const ana = await joinAs(roomCode, 'Ana');

      const markedAway = next(host, 'lobby:update');
      ana.client.disconnect();
      await markedAway;

      const back = next(host, 'lobby:update');
      const phone = await connect();
      const res = await phone.emitWithAck('room:rejoin', { sessionToken: ana.sessionToken });

      expect(res).toMatchObject({ ok: true, data: { playerId: ana.playerId } });
      expect((await back).players).toMatchObject([
        { id: ana.playerId, name: 'Ana', connected: true },
      ]);

      // Waiting past the grace period must not remove a player who came back
      await sleep(GRACE_MS * 2);
      const rui = await joinAs(roomCode, 'Rui');
      expect(rui.lobby.players.map((p) => [p.name, p.connected])).toEqual([
        ['Ana', true],
        ['Rui', true],
      ]);
    });

    it('takes over the seat from a stale connection that has not timed out yet', async () => {
      const { roomCode } = await createRoom();
      const ana = await joinAs(roomCode, 'Ana');

      const oldKicked = new Promise((resolve) => ana.client.once('disconnect', resolve));
      const phone = await connect();
      const res = await phone.emitWithAck('room:rejoin', { sessionToken: ana.sessionToken });
      expect(res.ok).toBe(true);
      expect(await oldKicked).toBe('io server disconnect');

      // The kicked socket's disconnect must not mark the player as away
      const rui = await joinAs(roomCode, 'Rui');
      expect(rui.lobby.players.map((p) => p.connected)).toEqual([true, true]);
    });

    it('rejects an unknown or expired session token', async () => {
      const { roomCode } = await createRoom();
      const ana = await joinAs(roomCode, 'Ana');
      ana.client.disconnect();
      await sleep(GRACE_MS * 2);

      const phone = await connect();
      expect(await phone.emitWithAck('room:rejoin', { sessionToken: 'nope' })).toEqual({
        ok: false,
        error: 'INVALID_SESSION',
      });
      expect(await phone.emitWithAck('room:rejoin', { sessionToken: ana.sessionToken })).toEqual({
        ok: false,
        error: 'INVALID_SESSION',
      });
    });
  });

  describe('TV screen', () => {
    it('can refresh: players see it go and come back, and the room carries on', async () => {
      const { host, roomCode, screenToken } = await createRoom();
      const ana = await joinAs(roomCode, 'Ana');

      const tvGone = next(ana.client, 'lobby:update');
      host.disconnect();
      expect((await tvGone).screenConnected).toBe(false);

      const tvBack = next(ana.client, 'lobby:update');
      const tv = await connect();
      const res = await tv.emitWithAck('room:resume', { screenToken });
      expect(res).toMatchObject({ ok: true, data: { lobby: { roomCode, players: [{}] } } });
      expect((await tvBack).screenConnected).toBe(true);

      // Still alive after the screen grace period
      await sleep(SCREEN_GRACE * 1.5);
      const rui = await joinAs(roomCode, 'Rui');
      expect(rui.lobby.players).toHaveLength(2);
    });

    it('gets the current game screen straight away when it resumes mid-game', async () => {
      const { host, roomCode, screenToken } = await createRoom();
      const ana = await joinAs(roomCode, 'Ana');
      await startTrivia(ana.client);
      host.disconnect();

      const tv = await connect();
      const screen = next(tv, 'game:host');
      await tv.emitWithAck('room:resume', { screenToken });
      expect((await screen).view).toMatchObject({
        round: 1,
        phase: expect.stringMatching(/countdown|question/),
      });
    });

    it('closes the room for everyone when the TV stays away too long', async () => {
      const { host, roomCode, screenToken } = await createRoom();
      const ana = await joinAs(roomCode, 'Ana');

      const closed = next(ana.client, 'room:closed');
      host.disconnect();
      expect(await closed).toBe('SCREEN_LEFT');

      const late = await connect();
      expect(await late.emitWithAck('room:join', { roomCode, name: 'Rui' })).toEqual({
        ok: false,
        error: 'ROOM_NOT_FOUND',
      });
      expect(await late.emitWithAck('room:resume', { screenToken })).toEqual({
        ok: false,
        error: 'INVALID_SESSION',
      });
    });
  });

  describe('leader', () => {
    it('can kick a player, who is told, disconnected and cannot come back with their token', async () => {
      const { host, roomCode } = await createRoom();
      const ana = await joinAs(roomCode, 'Ana');
      const rui = await joinAs(roomCode, 'Rui');

      const ruiKicked = next(rui.client, 'room:kicked');
      const ruiGone = new Promise((resolve) => rui.client.once('disconnect', resolve));
      const hostUpdate = next(host, 'lobby:update');

      expect(await ana.client.emitWithAck('room:kick', { playerId: rui.playerId })).toEqual({
        ok: true,
        data: null,
      });
      await ruiKicked;
      expect(await ruiGone).toBe('io server disconnect');
      expect((await hostUpdate).players.map((p) => p.name)).toEqual(['Ana']);

      const phone = await connect();
      expect(await phone.emitWithAck('room:rejoin', { sessionToken: rui.sessionToken })).toEqual({
        ok: false,
        error: 'INVALID_SESSION',
      });
    });

    it('only lets the leader kick, never themselves, and not during a game', async () => {
      const { roomCode } = await createRoom();
      const ana = await joinAs(roomCode, 'Ana');
      const rui = await joinAs(roomCode, 'Rui');

      expect(await rui.client.emitWithAck('room:kick', { playerId: ana.playerId })).toEqual({
        ok: false,
        error: 'NOT_LEADER',
      });
      expect(await ana.client.emitWithAck('room:kick', { playerId: ana.playerId })).toEqual({
        ok: false,
        error: 'INVALID_PAYLOAD',
      });
      expect(await ana.client.emitWithAck('room:kick', { playerId: 'nobody' })).toEqual({
        ok: false,
        error: 'PLAYER_NOT_FOUND',
      });

      await startTrivia(ana.client, [rui.client]);
      expect(await ana.client.emitWithAck('room:kick', { playerId: rui.playerId })).toEqual({
        ok: false,
        error: 'GAME_IN_PROGRESS',
      });
    });

    it('passes to the next player once the leader is gone for good', async () => {
      const { host, roomCode } = await createRoom();
      const ana = await joinAs(roomCode, 'Ana');
      const rui = await joinAs(roomCode, 'Rui');

      const ruiLeads = new Promise<void>((resolve) =>
        host.on('lobby:update', (lobby) => lobby.leaderId === rui.playerId && resolve()),
      );
      ana.client.disconnect();
      await ruiLeads; // after the grace period

      expect(await rui.client.emitWithAck('library:open')).toEqual({ ok: true, data: null });
    });
  });

  describe('trivia', () => {
    type HostUpdate = GameUpdate<TriviaHostView>;
    type PlayerUpdate = GameUpdate<TriviaPlayerView>;

    const hostSees = (host: Client, match: (u: HostUpdate) => boolean) =>
      waitFor<HostUpdate>(host, 'game:host', match);
    const playerSees = (player: Client, match: (u: PlayerUpdate) => boolean) =>
      waitFor<PlayerUpdate>(player, 'game:player', match);

    async function startedGame() {
      const { host, roomCode } = await createRoom();
      const ana = await joinAs(roomCode, 'Ana');
      const rui = await joinAs(roomCode, 'Rui');

      const hostQ1 = hostSees(host, (u) => u.view.phase === 'question');
      const anaQ1 = playerSees(ana.client, (u) => u.view.phase === 'question');
      // Ana joined first, so she is the leader
      await startTrivia(ana.client, [rui.client]);
      return { host, roomCode, ana, rui, hostQ1: await hostQ1, anaQ1: await anaQ1 };
    }

    describe('setup', () => {
      const ok = { ok: true, data: null };
      const music = { topic: 'music', secondsPerQuestion: 30, questionCount: 20 } as const;

      async function inSetup() {
        const { host, roomCode } = await createRoom();
        const ana = await joinAs(roomCode, 'Ana');
        const rui = await joinAs(roomCode, 'Rui');
        await ana.client.emitWithAck('library:open');
        const opened = next(host, 'lobby:update');
        await ana.client.emitWithAck('library:select');
        return { host, roomCode, ana, rui, lobby: await opened };
      }

      it('opens with the default settings, nobody ready, and only the leader can change them', async () => {
        const { ana, rui, host, lobby } = await inSetup();
        expect(lobby).toMatchObject({
          status: 'setup',
          setup: {
            gameId: 'trivia',
            options: { topic: 'general', secondsPerQuestion: 15, questionCount: 10 },
            readyIds: [],
          },
        });

        expect(await rui.client.emitWithAck('setup:options', music)).toEqual({
          ok: false,
          error: 'NOT_LEADER',
        });
        expect(
          await ana.client.emitWithAck('setup:options', {
            ...music,
            secondsPerQuestion: 12,
          } as never),
        ).toEqual({ ok: false, error: 'INVALID_PAYLOAD' });

        const changed = next(host, 'lobby:update');
        expect(await ana.client.emitWithAck('setup:options', music)).toEqual(ok);
        expect((await changed).setup?.options).toEqual(music);
      });

      it('starts only once everyone is ready, using the chosen settings', async () => {
        const { host, ana, rui } = await inSetup();
        await ana.client.emitWithAck('setup:options', music);
        await ana.client.emitWithAck('setup:ready', { ready: true });

        let started = false;
        host.once('game:host', () => (started = true));
        await sleep(100);
        expect(started).toBe(false); // still waiting for Rui

        const firstScreen = next(host, 'game:host');
        expect(await rui.client.emitWithAck('setup:ready', { ready: true })).toEqual(ok);
        // A "get ready" countdown first, with the question still hidden
        expect((await firstScreen).view).toMatchObject({
          topic: 'music',
          phase: 'countdown',
          prompt: '',
          round: 1,
          totalRounds: 2, // capped by the test config
        });
      });

      it('un-readies the leader when they change the settings', async () => {
        const { host, ana } = await inSetup();
        await ana.client.emitWithAck('setup:ready', { ready: true });

        const changed = next(host, 'lobby:update');
        await ana.client.emitWithAck('setup:options', music);
        expect((await changed).setup?.readyIds).toEqual([]);
      });

      it('does not wait for a player who disconnected', async () => {
        const { host, ana, rui } = await inSetup();
        await ana.client.emitWithAck('setup:ready', { ready: true });

        const firstQuestion = next(host, 'game:host');
        rui.client.disconnect();
        expect((await firstQuestion).view.playerIds).toEqual([ana.playerId]);
      });

      it('goes back to the library on cancel, and remembers the settings next time', async () => {
        const { host, ana } = await inSetup();
        await ana.client.emitWithAck('setup:options', music);

        const cancelled = next(host, 'lobby:update');
        expect(await ana.client.emitWithAck('setup:cancel')).toEqual(ok);
        expect((await cancelled).status).toBe('library');

        const reopened = next(host, 'lobby:update');
        await ana.client.emitWithAck('library:select');
        expect((await reopened).setup?.options).toEqual(music);
      });
    });

    it('only the leader picks the game: not the TV screen, not other players', async () => {
      const { host, roomCode } = await createRoom();
      const ana = await joinAs(roomCode, 'Ana');
      const rui = await joinAs(roomCode, 'Rui');
      await ana.client.emitWithAck('library:open');

      expect(ana.lobby.leaderId).toBe(ana.playerId);
      expect(await host.emitWithAck('library:select')).toEqual({ ok: false, error: 'NOT_LEADER' });
      expect(await rui.client.emitWithAck('library:select')).toEqual({
        ok: false,
        error: 'NOT_LEADER',
      });
    });

    it('sends the TV the question and each player only their choices', async () => {
      const { hostQ1, anaQ1 } = await startedGame();

      expect(hostQ1.view).toMatchObject({
        round: 1,
        totalRounds: 2,
        playerIds: expect.any(Array),
        correctChoice: null,
      });
      expect(hostQ1.view.prompt).not.toBe('');
      expect(hostQ1.serverTime).toBeTypeOf('number');
      expect(anaQ1.view.choices).toEqual(hostQ1.view.choices);
      expect(anaQ1.view).not.toHaveProperty('prompt');
      expect(anaQ1.view).not.toHaveProperty('correctChoice');
    });

    it('reveals early once everyone answered, then plays to the end', async () => {
      const { host, ana, rui, hostQ1 } = await startedGame();

      const oneAnswered = hostSees(host, (u) => u.view.answeredIds.length === 1);
      expect(await ana.client.emitWithAck('game:answer', { choice: 0 })).toEqual({
        ok: true,
        data: null,
      });
      await oneAnswered;

      const reveal = hostSees(host, (u) => u.view.phase === 'reveal');
      const ruiResult = playerSees(rui.client, (u) => u.view.phase === 'reveal');
      await rui.client.emitWithAck('game:answer', { choice: 1 });

      const { view } = await reveal;
      expect(view.correctChoice).toBeTypeOf('number');
      expect(view.picks).toHaveLength(2);
      // Revealed well before the 400ms question timer would have run out
      expect(Date.now() - hostQ1.serverTime).toBeLessThan(QUESTION_MS);
      expect((await ruiResult).view.lastResult).toEqual({
        correct: view.correctChoice === 1,
        missed: false,
        points: expect.any(Number),
      });

      // Nobody answers round 2: the timer moves the game on to the end
      const finished = await hostSees(host, (u) => u.view.phase === 'finished');
      expect(finished.view.leaderboard.map((e) => e.playerId).sort()).toEqual(
        [ana.playerId, rui.playerId].sort(),
      );
    });

    it('blocks new players mid-game and returns to the library when the leader ends it', async () => {
      const { host, roomCode, ana, rui } = await startedGame();

      const late = await connect();
      expect(await late.emitWithAck('room:join', { roomCode, name: 'Late' })).toEqual({
        ok: false,
        error: 'GAME_IN_PROGRESS',
      });
      expect(await rui.client.emitWithAck('game:end')).toEqual({ ok: false, error: 'NOT_LEADER' });

      const backInLibrary = next(host, 'lobby:update');
      expect(await ana.client.emitWithAck('game:end')).toEqual({ ok: true, data: null });
      expect((await backInLibrary).status).toBe('library');
    });

    it('sends a player who reconnects mid-game the current screen right away', async () => {
      const { ana } = await startedGame();
      ana.client.disconnect();

      const phone = await connect();
      const screen = playerSees(phone, () => true);
      await phone.emitWithAck('room:rejoin', { sessionToken: ana.sessionToken });
      expect((await screen).view).toMatchObject({ round: 1, phase: 'question' });
    });
  });

  describe('draw & guess', () => {
    type HostUpdate = GameUpdate<DrawHostView>;
    type PlayerUpdate = GameUpdate<DrawPlayerView>;
    const ok = { ok: true, data: null };
    const quick = { secondsToDraw: 45, rounds: 1 } as const;
    const stroke: Stroke = { id: 1, color: 0, size: 1, points: [100, 100, 200, 250] };

    const hostSees = (host: Client, match: (u: HostUpdate) => boolean) =>
      waitFor<HostUpdate>(host, 'game:host', match);
    const playerSees = (player: Client, match: (u: PlayerUpdate) => boolean) =>
      waitFor<PlayerUpdate>(player, 'game:player', match);
    /** Resolves true if `event` arrives within `ms`. */
    const arrives = (client: Client, event: keyof ServerToClientEvents, ms = 150) =>
      new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), ms);
        client.once(event, () => {
          clearTimeout(timer);
          resolve(true);
        });
      });

    /** Ana (the leader) picks Draw & Guess, the first game of the Creative category. */
    async function inDrawSetup() {
      const { host, roomCode, screenToken } = await createRoom();
      const ana = await joinAs(roomCode, 'Ana');
      const rui = await joinAs(roomCode, 'Rui');
      await ana.client.emitWithAck('library:open');
      await remote(ana.client, 'up', 'right', 'ok', 'down');
      const opened = next(host, 'lobby:update');
      expect(await ana.client.emitWithAck('library:select')).toEqual(ok);
      return { host, roomCode, screenToken, ana, rui, lobby: await opened };
    }

    /** Started, with Ana (first to join) drawing first. Resolves once she sees her words. */
    async function startedDraw() {
      const setup = await inDrawSetup();
      const { ana, rui } = setup;
      const choosing = playerSees(ana.client, (u) => u.view.phase === 'choosing');
      await ana.client.emitWithAck('setup:options', quick);
      await rui.client.emitWithAck('setup:ready', { ready: true });
      await ana.client.emitWithAck('setup:ready', { ready: true });
      return { ...setup, choices: (await choosing).view.wordChoices };
    }

    /** Ana chooses her first word; resolves with it once the TV shows the drawing phase. */
    async function drawing() {
      const game = await startedDraw();
      const started = hostSees(game.host, (u) => u.view.phase === 'drawing');
      expect(await game.ana.client.emitWithAck('draw:choose', { index: 0 })).toEqual(ok);
      return { ...game, word: game.choices[0]!, hostView: (await started).view };
    }

    it('opens its own settings, validated as Draw & Guess settings', async () => {
      const { ana, lobby } = await inDrawSetup();
      expect(lobby.setup).toEqual({
        gameId: 'draw',
        options: { secondsToDraw: 60, rounds: 1 },
        readyIds: [],
      });
      const trivia = { topic: 'music', secondsPerQuestion: 30, questionCount: 20 } as const;
      expect(await ana.client.emitWithAck('setup:options', trivia)).toEqual({
        ok: false,
        error: 'INVALID_PAYLOAD',
      });
      expect(await ana.client.emitWithAck('setup:options', quick)).toEqual(ok);
    });

    it('needs at least two players to start', async () => {
      const { host, ana, rui } = await inDrawSetup();
      rui.client.disconnect();
      await sleep(50);
      const started = arrives(host, 'game:host');
      await ana.client.emitWithAck('setup:ready', { ready: true });
      expect(await started).toBe(false);
    });

    it('shows the word choices to the artist only, and only the artist can choose', async () => {
      const { rui, choices } = await startedDraw();
      expect(choices).toHaveLength(3);
      expect(await rui.client.emitWithAck('draw:choose', { index: 0 })).toEqual({
        ok: false,
        error: 'WRONG_PHASE',
      });
    });

    it('streams the strokes of the artist to the TV only, with undo and clear', async () => {
      const { host, ana, rui, word, hostView } = await drawing();
      expect(hostView.hint).toMatch(/^[_ ]+$/);
      expect(hostView.hint).toHaveLength(word.length);

      // Someone who isn't drawing can't draw
      const fromRui = arrives(host, 'draw:stroke');
      rui.client.emit('draw:stroke', stroke);
      expect(await fromRui).toBe(false);

      const onTv = next(host, 'draw:stroke');
      const onRuisPhone = arrives(rui.client, 'draw:stroke');
      ana.client.emit('draw:stroke', stroke);
      expect(await onTv).toEqual(stroke);
      expect(await onRuisPhone).toBe(false);

      const undo = arrives(host, 'draw:undo');
      ana.client.emit('draw:undo');
      expect(await undo).toBe(true);
      const clear = arrives(host, 'draw:clear');
      ana.client.emit('draw:clear');
      expect(await clear).toBe(true);
    });

    it('rejects malformed strokes', async () => {
      const { host, ana } = await drawing();
      const received = arrives(host, 'draw:stroke');
      ana.client.emit('draw:stroke', { ...stroke, points: [1, 2, 3] });
      ana.client.emit('draw:stroke', { ...stroke, color: 99 });
      ana.client.emit('draw:stroke', { ...stroke, points: [5000, 5000] });
      expect(await received).toBe(false);
    });

    it('shows wrong guesses on the TV, and ends the turn once everyone guessed', async () => {
      const { host, ana, rui, word } = await drawing();

      const wrong = hostSees(host, (u) => u.view.feed.length === 1);
      expect(await rui.client.emitWithAck('draw:guess', { text: 'definitely not it' })).toEqual(ok);
      expect((await wrong).view.feed).toEqual([
        { playerId: rui.playerId, text: 'definitely not it' },
      ]);

      await sleep(550); // the guess cooldown
      const reveal = hostSees(host, (u) => u.view.phase === 'reveal');
      const anaResult = playerSees(ana.client, (u) => u.view.phase === 'reveal');
      await rui.client.emitWithAck('draw:guess', { text: word.toUpperCase() });

      const { view } = await reveal;
      expect(view).toMatchObject({ hint: word, guessedIds: [rui.playerId] });
      const ruiGained = view.leaderboard.find((e) => e.playerId === rui.playerId)?.gained;
      expect(ruiGained).toBeGreaterThan(200);
      expect((await anaResult).view).toMatchObject({ word, gained: 200 });

      // Then it's Rui's turn to draw
      const ruiChooses = playerSees(rui.client, (u) => u.view.phase === 'choosing');
      expect((await ruiChooses).view).toMatchObject({ isArtist: true, turn: 2, totalTurns: 2 });
    });

    it('gives a TV that refreshes mid-turn the drawing so far', async () => {
      const { host, roomCode, screenToken, ana } = await drawing();
      const relayed = next(host, 'draw:stroke');
      ana.client.emit('draw:stroke', stroke);
      ana.client.emit('draw:stroke', { ...stroke, points: [300, 300] });
      await relayed;
      await sleep(50);
      host.disconnect();

      const tv = await connect();
      const synced = next(tv, 'draw:sync');
      const res = await tv.emitWithAck('room:resume', { screenToken });
      expect(res.ok && res.data.lobby.roomCode).toBe(roomCode);
      expect(await synced).toEqual([{ ...stroke, points: [100, 100, 200, 250, 300, 300] }]);
    });
  });

  describe('drawing phone', () => {
    type HostUpdate = GameUpdate<PhoneHostView>;
    type PlayerUpdate = GameUpdate<PhonePlayerView>;
    const ok = { ok: true, data: null };
    const dot: SketchOp = { kind: 'pen', color: 3, size: 1, points: [500, 500] };

    const hostSees = (host: Client, match: (u: HostUpdate) => boolean) =>
      waitFor<HostUpdate>(host, 'game:host', match);
    const playerSees = (player: Client, match: (u: PlayerUpdate) => boolean) =>
      waitFor<PlayerUpdate>(player, 'game:player', match);

    /** Ana (the leader), Rui and Eva start Drawing Phone, the second Creative game. */
    async function started() {
      const { host, roomCode } = await createRoom();
      const ana = await joinAs(roomCode, 'Ana');
      const rui = await joinAs(roomCode, 'Rui');
      const eva = await joinAs(roomCode, 'Eva'); // the library opens by itself
      await remote(ana.client, 'up', 'right', 'ok', 'down', 'right', 'ok');
      expect(
        await ana.client.emitWithAck('setup:options', { secondsToDraw: 30, language: 'pt' }),
      ).toEqual(ok);
      expect(
        await ana.client.emitWithAck('setup:options', {
          secondsToDraw: 45,
          language: 'en',
        } as never),
      ).toEqual({ ok: false, error: 'INVALID_PAYLOAD' });

      const writing = hostSees(host, (u) => u.view.phase === 'write');
      for (const player of [rui, eva, ana]) {
        await player.client.emitWithAck('setup:ready', { ready: true });
      }
      expect((await writing).view).toMatchObject({ step: 1, totalSteps: 3 });
      return { host, players: [ana, rui, eva] };
    }

    it('plays a whole game: write, draw, guess, and the reveal on the TV', async () => {
      const { host, players } = await started();
      const [ana, rui, eva] = players;

      // Ana asks for a random (Portuguese) phrase; the others type theirs
      const random = await ana!.client.emitWithAck('phone:random');
      expect(random.ok && random.data.text.length).toBeGreaterThan(0);
      rui!.client.emit('phone:text', { text: 'A cat on a bus' });
      eva!.client.emit('phone:text', { text: 'A dog on a plane' });

      const oneDone = hostSees(host, (u) => u.view.doneIds.length === 1);
      expect(await rui!.client.emitWithAck('phone:done', { done: true })).toEqual(ok);
      expect((await oneDone).view.doneIds).toEqual([rui!.playerId]);

      // Everyone done: straight on to drawing, each with someone else's phrase
      const drawing = Promise.all(
        players.map((p) => playerSees(p.client, (u) => u.view.phase === 'draw')),
      );
      await eva!.client.emitWithAck('phone:done', { done: true });
      await ana!.client.emitWithAck('phone:done', { done: true });
      const phrases = (await drawing).map((u) => u.view.phrase);
      expect(new Set(phrases).size).toBe(3);
      expect(phrases).toContain('A cat on a bus');

      // Malformed actions are dropped; undo and redo keep the server's copy in step
      for (const p of players) {
        p.client.emit('phone:op', { kind: 'pen', color: 99, size: 0, points: [1, 2] } as never);
        p.client.emit('phone:op', dot);
        p.client.emit('phone:op', { kind: 'clear' });
        p.client.emit('phone:undo');
      }
      const guessing = Promise.all(
        players.map((p) => playerSees(p.client, (u) => u.view.phase === 'guess')),
      );
      for (const p of players) await p.client.emitWithAck('phone:done', { done: true });
      for (const { view } of await guessing) expect(view.drawing).toEqual([dot]);

      // Time runs out (40 "seconds"): Rui's half-typed guess still counts
      rui!.client.emit('phone:text', { text: 'a red dot' });
      const reveal = await hostSees(host, (u) => u.view.phase === 'reveal');
      expect(reveal.view.reveal).toMatchObject({ chain: 0, entry: 0, entryCount: 3 });
      expect(reveal.view.reveal?.current).toMatchObject({ kind: 'text', playerId: ana!.playerId });

      // Only the leader can skip ahead
      expect(await rui!.client.emitWithAck('phone:next')).toEqual({
        ok: false,
        error: 'NOT_LEADER',
      });
      const skipped = hostSees(host, (u) => u.view.reveal?.entry === 1);
      expect(await ana!.client.emitWithAck('phone:next')).toEqual(ok);
      expect((await skipped).view.reveal?.current).toMatchObject({ kind: 'sketch', ops: [dot] });

      const finished = await hostSees(host, (u) => u.view.phase === 'finished');
      const finals = finished.view.summaries.map((summary) => summary.final);
      expect(finals).toContain('a red dot');
      expect(finished.view.summaries.map((summary) => summary.original)).toContain(
        'A dog on a plane',
      );
    }, 10_000);

    it('gives a phone that comes back mid-step its draft', async () => {
      const { players } = await started();
      const [, rui] = players;
      rui!.client.emit('phone:text', { text: 'half a thought' });
      await sleep(50);
      rui!.client.disconnect();

      const phone = await connect();
      const back = next(phone, 'game:player');
      await phone.emitWithAck('room:rejoin', { sessionToken: rui!.sessionToken });
      expect((await back).view).toMatchObject({
        game: 'phone',
        phase: 'write',
        draft: 'half a thought',
      });
    });
  });

  describe('werewolf', () => {
    type HostUpdate = GameUpdate<WerewolfHostView>;
    type PlayerUpdate = GameUpdate<WerewolfPlayerView>;
    const ok = { ok: true, data: null };

    const hostSees = (host: Client, match: (u: HostUpdate) => boolean) =>
      waitFor<HostUpdate>(host, 'game:host', match);
    const playerSees = (player: Client, match: (u: PlayerUpdate) => boolean) =>
      waitFor<PlayerUpdate>(player, 'game:player', match);

    it('plays a game: secret roles, a night, a vote, and the village wins', async () => {
      const { host, roomCode } = await createRoom();
      const players: Awaited<ReturnType<typeof joinAs>>[] = [];
      for (const name of ['Ana', 'Rui', 'Eva', 'Ivo']) players.push(await joinAs(roomCode, name));
      const [ana] = players;

      // Werewolf is the first Social game, on the third tab
      await remote(ana!.client, 'up', 'right', 'right', 'ok', 'down', 'ok');
      expect(
        await ana!.client.emitWithAck('setup:options', { secondsToDiscuss: 60, revealRoles: true }),
      ).toEqual(ok);
      const views = players.map((p) => playerSees(p.client, (u) => u.view.phase === 'roles'));
      const roles = hostSees(host, (u) => u.view.phase === 'roles');
      for (const p of players) await p.client.emitWithAck('setup:ready', { ready: true });

      // The TV knows how many of each role there are, but not who
      expect((await roles).view).toMatchObject({
        roleCounts: { werewolf: 1, seer: 1, doctor: 0, villager: 2 },
        knownRoles: {},
      });
      const roleOf = new Map((await Promise.all(views)).map((u, i) => [players[i]!, u.view.role]));
      const wolf = players.find((p) => roleOf.get(p) === 'werewolf')!;
      const villagers = players.filter((p) => p !== wolf);
      expect(villagers).toHaveLength(3);

      // Nothing to pick yet; then everyone confirms their role
      expect(await wolf.client.emitWithAck('wolf:pick', { targetId: ana!.playerId })).toEqual({
        ok: false,
        error: 'WRONG_PHASE',
      });
      const night = hostSees(host, (u) => u.view.phase === 'night');
      for (const p of players) expect(await p.client.emitWithAck('wolf:ready')).toEqual(ok);
      await night;

      // The werewolf eats the first villager; everyone else picks the werewolf
      const [victim, ...living] = villagers;
      const dawn = hostSees(host, (u) => u.view.phase === 'dawn');
      const day = hostSees(host, (u) => u.view.phase === 'day');
      expect(await wolf.client.emitWithAck('wolf:pick', { targetId: victim!.playerId })).toEqual(
        ok,
      );
      for (const p of villagers) {
        const target = p === victim ? living[0]! : wolf;
        await p.client.emitWithAck('wolf:pick', { targetId: target.playerId });
      }
      expect((await dawn).view.dawn).toEqual({
        outcome: 'killed',
        victimId: victim!.playerId,
        role: roleOf.get(victim!),
      });

      // The dead can't vote; the living vote the werewolf out
      await day;
      const vote = hostSees(host, (u) => u.view.phase === 'vote');
      for (const p of [wolf, ...living]) await p.client.emitWithAck('wolf:ready');
      await vote;
      expect(await victim!.client.emitWithAck('wolf:pick', { targetId: null })).toEqual({
        ok: false,
        error: 'WRONG_PHASE',
      });
      const verdict = hostSees(host, (u) => u.view.phase === 'verdict');
      await wolf.client.emitWithAck('wolf:pick', { targetId: null });
      for (const p of living) await p.client.emitWithAck('wolf:pick', { targetId: wolf.playerId });
      expect((await verdict).view.verdict).toMatchObject({
        eliminatedId: wolf.playerId,
        role: 'werewolf',
      });

      const finished = await hostSees(host, (u) => u.view.phase === 'finished');
      expect(finished.view.winner).toBe('village');
      expect(Object.keys(finished.view.knownRoles)).toHaveLength(4);
    }, 10_000);
  });
});
