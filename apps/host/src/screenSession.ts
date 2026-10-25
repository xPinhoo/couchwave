const KEY = 'couchwave:screen';

/**
 * The TV keeps its screen token in sessionStorage: a refresh resumes the same room, while
 * another tab (or Create Game Room) starts a new one.
 */
export function loadScreenToken(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveScreenToken(token: string): void {
  try {
    window.sessionStorage.setItem(KEY, token);
  } catch {
    // Storage unavailable (private mode): a refresh will simply create a new room
  }
}

export function clearScreenToken(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
