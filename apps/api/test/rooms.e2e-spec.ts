import type { AddressInfo } from 'node:net';
import { GAMES, type ClientToServerEvents, type ServerToClientEvents } from '@couchwave/shared';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import {
  RECONNECT_GRACE_MS,
  SCREEN_GRACE_MS,
  TRIVIA_CONFIG,
} from '../src/rooms/rooms.constants.js';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const GRACE_MS = 300;
const SCREEN_GRACE = 400;
const QUESTION_MS = 400;
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
      .overrideProvider(TRIVIA_CONFIG)
      .useValue({ rounds: 2, questionMs: QUESTION_MS, revealMs: 150 })
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

  /** The leader opens the games library and starts trivia (the first game). */
  async function startTrivia(leader: Client) {
    expect(await leader.emitWithAck('library:open')).toEqual({ ok: true, data: null });
    expect(await leader.emitWithAck('library:select')).toEqual({ ok: true, data: null });
  }

  const next = <E extends keyof ServerToClientEvents>(client: Client, event: E) =>
    new Promise<Parameters<ServerToClientEvents[E]>[0]>((resolve) => {
      client.once(event, ((arg: Parameters<ServerToClientEvents[E]>[0]) => resolve(arg)) as never);
    });

  it('GET /health', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
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
        avatar: { kind: 'preset', id: 'unicorn' },
      });
      const hostUpdate = next(host, 'lobby:update');
      const rui = await connect();
      await rui.emitWithAck('room:join', { roomCode, name: 'Rui', avatar: photo });

      expect((await hostUpdate).players.map((p) => p.avatar)).toEqual([
        { kind: 'preset', id: 'unicorn' },
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
      expect(await ana.client.emitWithAck('library:move', { delta: 1 })).toEqual({
        ok: false,
        error: 'WRONG_PHASE',
      });

      const opened = next(host, 'lobby:update');
      const ruiSeesOpen = next(rui.client, 'lobby:update');
      await ana.client.emitWithAck('library:open');
      expect(await opened).toMatchObject({ status: 'library', selectedGame: 0 });
      await ruiSeesOpen; // the broadcast can land after Ana's ack

      const wrapped = next(rui.client, 'lobby:update');
      await ana.client.emitWithAck('library:move', { delta: -1 });
      expect((await wrapped).selectedGame).toBe(GAMES.length - 1);

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

    it('refuses to start a game that is not available yet', async () => {
      const { roomCode } = await createRoom();
      const ana = await joinAs(roomCode, 'Ana');
      await ana.client.emitWithAck('library:open');
      await ana.client.emitWithAck('library:move', { delta: 1 });

      expect(GAMES[1]?.available).toBe(false);
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
      expect((await screen).view).toMatchObject({ round: 1, phase: 'question' });
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

      await startTrivia(ana.client);
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
    type HostUpdate = Parameters<ServerToClientEvents['game:host']>[0];
    type PlayerUpdate = Parameters<ServerToClientEvents['game:player']>[0];

    /** Resolves with the first update matching `match`, failing after `timeoutMs`. */
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
      await startTrivia(ana.client);
      return { host, roomCode, ana, rui, hostQ1: await hostQ1, anaQ1: await anaQ1 };
    }

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
        playerCount: 2,
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

      const oneAnswered = hostSees(host, (u) => u.view.answeredCount === 1);
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
      expect(view.choiceCounts?.reduce((a, b) => a + b, 0)).toBe(2);
      // Revealed well before the 400ms question timer would have run out
      expect(Date.now() - hostQ1.serverTime).toBeLessThan(QUESTION_MS);
      expect((await ruiResult).view.lastResult).toEqual({
        correct: view.correctChoice === 1,
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
});
