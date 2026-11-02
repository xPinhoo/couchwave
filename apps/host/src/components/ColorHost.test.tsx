import type { ColorHostView } from '@couchwave/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { lobbyState, player } from '../test/fixtures';
import { ColorHost } from './ColorHost';

const lobby = lobbyState({
  status: 'playing',
  players: [player('ana', 'Ana'), player('rui', 'Rui')],
});

const view = (overrides: Partial<ColorHostView>): ColorHostView => ({
  game: 'color',
  phase: 'pick',
  category: 'flags',
  round: 2,
  totalRounds: 5,
  puzzleId: 'japan',
  name: "Japan's flag",
  endsAt: Date.now() + 20_000,
  playerIds: ['ana', 'rui'],
  lockedIds: [],
  answer: null,
  results: [],
  leaderboard: [
    { playerId: 'ana', score: 1_500, gained: 900 },
    { playerId: 'rui', score: 300, gained: 0 },
  ],
  ...overrides,
});

const renderView = (overrides: Partial<ColorHostView>) =>
  render(
    <ColorHost
      game={{ update: { serverTime: Date.now(), view: view(overrides) }, receivedAt: Date.now() }}
      lobby={lobby}
    />,
  );

const picture = () => decodeURIComponent(screen.getByRole('img').getAttribute('src') ?? '');

describe('ColorHost', () => {
  it('hides the picture during the countdown', () => {
    renderView({ phase: 'countdown', puzzleId: '', name: '', endsAt: Date.now() + 5_000 });
    expect(screen.getByRole('heading', { name: 'Get ready!' })).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows the picture with its colour missing, and who has locked in', () => {
    renderView({ lockedIds: ['rui'] });
    expect(screen.getByRole('heading', { name: "Japan's flag" })).toBeInTheDocument();
    expect(screen.getByText('Round 2/5', { exact: false })).toBeInTheDocument();
    expect(picture()).toContain('url(#hidden)');
    expect(screen.getAllByLabelText('Locked in')).toHaveLength(1);
    expect(screen.getByText('1/2 locked in')).toBeInTheDocument();
  });

  it('reveals the real colour and how close everyone got', () => {
    renderView({
      phase: 'reveal',
      answer: '#bc002d',
      results: [
        { playerId: 'ana', color: '#c00830', accuracy: 90, points: 900 },
        { playerId: 'rui', color: null, accuracy: 0, points: 0 },
      ],
    });
    expect(picture()).toContain('fill="#bc002d"');
    expect(screen.getByText('#BC002D')).toBeInTheDocument();
    const rows = within(screen.getByRole('list', { name: 'How close everyone got' })).getAllByRole(
      'listitem',
    );
    expect(rows[0]).toHaveTextContent('Ana#C0083090%1500 +900');
    expect(rows[1]).toHaveTextContent('RuiNo colour0%300');
  });

  it('ends on the podium', () => {
    renderView({ phase: 'finished', endsAt: null, puzzleId: '', name: '' });
    expect(screen.getByRole('list', { name: 'Podium' })).toHaveTextContent('Ana');
  });
});
