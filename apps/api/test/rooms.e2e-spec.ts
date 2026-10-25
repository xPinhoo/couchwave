import type { AddressInfo } from 'node:net';
import type { ClientToServerEvents, ServerToClientEvents } from '@couchwave/shared';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

describe('Rooms (e2e)', () => {
  let app: INestApplication;
  let url: string;
  const clients: Client[] = [];

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
    return { host, roomCode: res.data.roomCode };
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

  it('host creates a room with a 4-letter code and an empty lobby', async () => {
    const host = await connect();
    const res = await host.emitWithAck('room:create');

    expect(res).toMatchObject({
      ok: true,
      data: { roomCode: expect.stringMatching(/^[A-Z]{4}$/), players: [] },
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

  it('updates the lobby when a player disconnects', async () => {
    const { host, roomCode } = await createRoom();
    const ana = await connect();
    await ana.emitWithAck('room:join', { roomCode, name: 'Ana' });

    const update = next(host, 'lobby:update');
    ana.disconnect();
    expect((await update).players).toEqual([]);
  });

  it('closes the room for everyone when the host leaves', async () => {
    const { host, roomCode } = await createRoom();
    const ana = await connect();
    await ana.emitWithAck('room:join', { roomCode, name: 'Ana' });

    const closed = next(ana, 'room:closed');
    host.disconnect();
    expect(await closed).toBe('HOST_LEFT');

    const late = await connect();
    expect(await late.emitWithAck('room:join', { roomCode, name: 'Rui' })).toEqual({
      ok: false,
      error: 'ROOM_NOT_FOUND',
    });
  });
});
