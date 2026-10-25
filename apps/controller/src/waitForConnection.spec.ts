import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitForConnection, type ConnectableSocket } from './waitForConnection';

/** A minimal stand-in for a Socket.IO client socket. */
class FakeSocket extends EventEmitter implements ConnectableSocket {
  connected = false;
  active = true;
  connect = vi.fn<() => void>(() => {
    this.active = true;
  });

  /** Simulates the connection succeeding. */
  open(): void {
    this.connected = true;
    this.emit('connect');
  }
}

describe('waitForConnection', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves immediately when already connected', async () => {
    const socket = new FakeSocket();
    socket.connected = true;
    await expect(waitForConnection(socket)).resolves.toBe(true);
  });

  it('waits for a connection that is still being set up', async () => {
    const socket = new FakeSocket();
    const result = waitForConnection(socket, 5_000);

    vi.advanceTimersByTime(800);
    socket.open();

    await expect(result).resolves.toBe(true);
    expect(socket.listenerCount('connect')).toBe(0);
  });

  it('gives up after the timeout and stops listening', async () => {
    const socket = new FakeSocket();
    const result = waitForConnection(socket, 5_000);

    vi.advanceTimersByTime(5_000);

    await expect(result).resolves.toBe(false);
    expect(socket.listenerCount('connect')).toBe(0);
  });

  it('starts a new attempt when the socket is not trying to connect', async () => {
    const socket = new FakeSocket();
    socket.active = false;

    const result = waitForConnection(socket);
    expect(socket.connect).toHaveBeenCalledOnce();
    socket.open();

    await expect(result).resolves.toBe(true);
  });

  it('does not interfere with a reconnection already in progress', () => {
    const socket = new FakeSocket();
    void waitForConnection(socket);
    expect(socket.connect).not.toHaveBeenCalled();
  });
});
