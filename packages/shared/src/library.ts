import { GAME_CATEGORIES, GAMES } from './lobby.js';

/** Game cards per row on the TV, so ▲ ▼ can move between rows. */
export const LIBRARY_COLUMNS = 3;

export type LibraryDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Where the host is in the games menu. Every tab and every game card is a position, moved
 * between with the arrows like a TV remote. `category` is the tab whose games are shown: it
 * only changes when OK is pressed on another tab.
 */
export interface LibraryCursor {
  category: number;
  focus: { area: 'tabs' | 'games'; index: number };
}

/** The menu opens on the first game of the first tab, so OK straight away plays it. */
export const INITIAL_LIBRARY_CURSOR: LibraryCursor = {
  category: 0,
  focus: { area: 'games', index: 0 },
};

/** Indexes into `GAMES` of the games under a tab, in menu order. */
export function gamesInCategory(category: number): number[] {
  const id = GAME_CATEGORIES[category]?.id;
  return GAMES.flatMap((game, index) => (game.category === id ? [index] : []));
}

/** The game the cursor is on, as an index into `GAMES`, or undefined on a tab. */
export function focusedGame(cursor: LibraryCursor): number | undefined {
  return cursor.focus.area === 'games'
    ? gamesInCategory(cursor.category)[cursor.focus.index]
    : undefined;
}

/** How many tabs there are, and how many games each one holds. */
export interface LibraryLayout {
  tabs: number;
  games: (category: number) => number;
}

const GAMES_LAYOUT: LibraryLayout = {
  tabs: GAME_CATEGORIES.length,
  games: (category) => gamesInCategory(category).length,
};

/**
 * Moves to the neighbouring position in `direction`. Returns the same cursor when there is
 * nothing there: the menu never wraps around.
 */
export function moveLibraryCursor(
  cursor: LibraryCursor,
  direction: LibraryDirection,
  layout: LibraryLayout = GAMES_LAYOUT,
): LibraryCursor {
  const at = (area: 'tabs' | 'games', index: number): LibraryCursor => ({
    ...cursor,
    focus: { area, index },
  });
  const { area, index } = cursor.focus;

  if (area === 'tabs') {
    if (direction === 'left' && index > 0) return at('tabs', index - 1);
    if (direction === 'right' && index < layout.tabs - 1) return at('tabs', index + 1);
    // Down from the tabs lands on the first game of the tab being shown
    if (direction === 'down' && layout.games(cursor.category) > 0) return at('games', 0);
    return cursor;
  }

  const count = layout.games(cursor.category);
  const column = index % LIBRARY_COLUMNS;
  const row = Math.floor(index / LIBRARY_COLUMNS);
  const lastRow = Math.floor((count - 1) / LIBRARY_COLUMNS);
  switch (direction) {
    case 'left':
      return column > 0 ? at('games', index - 1) : cursor;
    case 'right':
      return column < LIBRARY_COLUMNS - 1 && index + 1 < count ? at('games', index + 1) : cursor;
    case 'up':
      // The top row goes up to the tab being shown
      return row > 0 ? at('games', index - LIBRARY_COLUMNS) : at('tabs', cursor.category);
    case 'down':
      // A shorter last row: land on its last card
      return row < lastRow ? at('games', Math.min(index + LIBRARY_COLUMNS, count - 1)) : cursor;
  }
}

export type LibraryOk =
  { kind: 'tab'; cursor: LibraryCursor } | { kind: 'game'; gameIndex: number } | { kind: 'none' };

/** OK on a tab shows its games; OK on a game picks it. OK on the tab already shown does nothing. */
export function pressLibraryOk(cursor: LibraryCursor): LibraryOk {
  if (cursor.focus.area === 'tabs') {
    return cursor.focus.index === cursor.category
      ? { kind: 'none' }
      : { kind: 'tab', cursor: { ...cursor, category: cursor.focus.index } };
  }
  const gameIndex = focusedGame(cursor);
  return gameIndex === undefined ? { kind: 'none' } : { kind: 'game', gameIndex };
}
