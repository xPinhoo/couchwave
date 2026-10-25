import { Platform } from 'react-native';

export interface StoredSession {
  sessionToken: string;
}

const KEY = 'couchwave:session';

// Native keeps the session in memory: enough to survive dropped connections while the
// app is alive. TODO: persist it (e.g. expo-secure-store) to also survive app restarts.
let memorySession: StoredSession | null = null;

/**
 * On web we use sessionStorage: it survives a page reload (common when a phone browser
 * discards a background tab) but is per-tab, so two tabs never fight over one seat.
 */
function webStorage(): Storage | null {
  if (Platform.OS !== 'web') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function loadSession(): StoredSession | null {
  const storage = webStorage();
  if (!storage) return memorySession;
  try {
    const raw = storage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  memorySession = session;
  try {
    webStorage()?.setItem(KEY, JSON.stringify(session));
  } catch {
    // Storage can be unavailable (private mode); the in-memory copy still works.
  }
}

export function clearSession(): void {
  memorySession = null;
  try {
    webStorage()?.removeItem(KEY);
  } catch {
    // ignore
  }
}
