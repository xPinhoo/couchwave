/** The parts of a Socket.IO client socket this helper needs. */
export interface ConnectableSocket {
  connected: boolean;
  /** True while Socket.IO is connecting or retrying on its own. */
  active: boolean;
  connect(): unknown;
  once(event: 'connect', listener: () => void): unknown;
  off(event: 'connect', listener: () => void): unknown;
}

export const CONNECT_TIMEOUT_MS = 5_000;

/**
 * Resolves true once the socket is connected, or false after `timeoutMs`. Right after the
 * page loads the socket is usually still connecting, so callers wait here instead of
 * failing straight away.
 */
export function waitForConnection(
  socket: ConnectableSocket,
  timeoutMs = CONNECT_TIMEOUT_MS,
): Promise<boolean> {
  if (socket.connected) return Promise.resolve(true);
  // Not even trying (e.g. the server disconnected us earlier): start a new attempt
  if (!socket.active) socket.connect();

  return new Promise((resolve) => {
    const onConnect = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      socket.off('connect', onConnect);
      resolve(false);
    }, timeoutMs);
    socket.once('connect', onConnect);
  });
}
