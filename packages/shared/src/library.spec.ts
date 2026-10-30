import { describe, expect, it } from 'vitest';
import {
  INITIAL_LIBRARY_CURSOR,
  focusedGame,
  moveLibraryCursor,
  pressLibraryOk,
  type LibraryCursor,
  type LibraryLayout,
} from './library.js';
import { GAMES } from './lobby.js';

const onGame = (index: number, category = 0): LibraryCursor => ({
  category,
  focus: { area: 'games', index },
});
const onTab = (index: number, category = 0): LibraryCursor => ({
  category,
  focus: { area: 'tabs', index },
});

describe('moveLibraryCursor', () => {
  // Three tabs; the first holds 7 games: two full rows of three and a last row of one
  const layout: LibraryLayout = { tabs: 3, games: (category) => (category === 0 ? 7 : 2) };
  const move = (cursor: LibraryCursor, direction: Parameters<typeof moveLibraryCursor>[1]) =>
    moveLibraryCursor(cursor, direction, layout).focus;

  it('moves around the grid of games like a TV remote', () => {
    expect(move(onGame(0), 'right')).toEqual({ area: 'games', index: 1 });
    expect(move(onGame(1), 'down')).toEqual({ area: 'games', index: 4 });
    expect(move(onGame(4), 'up')).toEqual({ area: 'games', index: 1 });
    expect(move(onGame(4), 'left')).toEqual({ area: 'games', index: 3 });
  });

  it('stops at the edges instead of wrapping around', () => {
    const edges: [LibraryCursor, Parameters<typeof moveLibraryCursor>[1]][] = [
      [onGame(0), 'left'],
      [onGame(2), 'right'],
      [onGame(6), 'down'],
      [onGame(6), 'right'],
      [onTab(0), 'left'],
      [onTab(2), 'right'],
      [onTab(1), 'up'],
    ];
    for (const [cursor, direction] of edges) {
      expect(moveLibraryCursor(cursor, direction, layout)).toBe(cursor);
    }
  });

  it('lands on the last card when the row below is shorter', () => {
    expect(move(onGame(5), 'down')).toEqual({ area: 'games', index: 6 });
  });

  it('goes up from the top row to the tab being shown, and back down to its first game', () => {
    expect(move(onGame(2, 1), 'up')).toEqual({ area: 'tabs', index: 1 });
    expect(move(onTab(2, 1), 'down')).toEqual({ area: 'games', index: 0 });
  });

  it('moves between tabs without changing which games are shown', () => {
    const moved = moveLibraryCursor(onTab(0), 'right', layout);
    expect(moved).toEqual({ category: 0, focus: { area: 'tabs', index: 1 } });
  });
});

describe('pressLibraryOk', () => {
  it('shows the focused tab', () => {
    expect(pressLibraryOk(onTab(1))).toEqual({ kind: 'tab', cursor: onTab(1, 1) });
    expect(pressLibraryOk(onTab(1, 1))).toEqual({ kind: 'none' });
  });

  it('picks the focused game', () => {
    expect(GAMES[focusedGame(INITIAL_LIBRARY_CURSOR)!]?.id).toBe('trivia');
    expect(pressLibraryOk(INITIAL_LIBRARY_CURSOR)).toEqual({
      kind: 'game',
      gameIndex: focusedGame(INITIAL_LIBRARY_CURSOR),
    });
  });
});
