import type { DrawHostView } from '@couchwave/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { lobbyState, player } from '../test/fixtures';
import { DrawHost } from './DrawHost';

const lobby = lobbyState({
  status: 'playing',
  players: [player('ana', 'Ana'), player('rui', 'Rui'), player('eva', 'Eva')],
});

const view = (overrides: Partial<DrawHostView>): DrawHostView => ({
  game: 'draw',
  phase: 'drawing',
  turn: 1,
  totalTurns: 3,
  artistId: 'ana',
  endsAt: Date.now() + 30_000,
  hint: '___ _____',
  guessedIds: [],
  feed: [],
  playerIds: ['ana', 'rui', 'eva'],
  leaderboard: [
    { playerId: 'rui', score: 800, gained: 800 },
    { playerId: 'ana', score: 200, gained: 200 },
    { playerId: 'eva', score: 0, gained: 0 },
  ],
  ...overrides,
});

const renderView = (overrides: Partial<DrawHostView>, strokes = 0) =>
  render(
    <DrawHost
      game={{ update: { serverTime: Date.now(), view: view(overrides) }, receivedAt: Date.now() }}
      lobby={lobby}
      strokes={Array.from({ length: strokes }, (_, id) => ({
        id,
        color: 0,
        size: 1,
        points: [0, 0],
      }))}
    />,
  );

describe('DrawHost', () => {
  it('shows who is choosing a word, on a blank canvas', () => {
    renderView({ phase: 'choosing', hint: '' }, 2);
    expect(screen.getByText('Ana is choosing a word…')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Drawing' })).toHaveAttribute('data-strokes', '0');
  });

  it('shows the drawing, the hint, who guessed it and the wrong guesses', () => {
    renderView(
      {
        guessedIds: ['eva'],
        feed: [{ playerId: 'rui', text: 'banana' }],
      },
      3,
    );

    expect(screen.getByRole('img', { name: 'Drawing' })).toHaveAttribute('data-strokes', '3');
    expect(screen.getByLabelText('Word to guess')).toHaveTextContent('___ _____');
    expect(screen.getByRole('list', { name: 'Guessed it' })).toHaveTextContent('Eva');
    expect(screen.getByRole('list', { name: 'Guesses' })).toHaveTextContent('Rui banana');
    expect(screen.getByText('Turn 1/3', { exact: false })).toBeInTheDocument();
  });

  it('reveals the word with the points of the turn', () => {
    renderView({ phase: 'reveal', hint: 'ice cream' });
    expect(screen.getByText('ice cream')).toBeInTheDocument();
    expect(screen.queryByLabelText('Word to guess')).not.toBeInTheDocument();

    const [first] = within(screen.getByRole('list', { name: 'Leaderboard' })).getAllByRole(
      'listitem',
    );
    expect(first).toHaveTextContent('Rui800 +800');
  });

  it('ends on the podium', () => {
    renderView({ phase: 'finished', endsAt: null });
    expect(screen.getByRole('list', { name: 'Podium' })).toBeInTheDocument();
  });
});
