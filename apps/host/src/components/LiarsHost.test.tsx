import type { LiarsHostView } from '@couchwave/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { lobbyState, player } from '../test/fixtures';
import { LiarsHost } from './LiarsHost';

const lobby = lobbyState({
  status: 'playing',
  players: [player('ana', 'Ana'), player('rui', 'Rui'), player('eva', 'Eva')],
});

const view = (overrides: Partial<LiarsHostView>): LiarsHostView => ({
  game: 'liars',
  phase: 'turn',
  round: 2,
  endsAt: Date.now() + 30_000,
  tableRank: 'Q',
  playerIds: ['ana', 'rui', 'eva'],
  aliveIds: ['ana', 'rui'],
  lives: { ana: 3, rui: 1, eva: 0 },
  maxLives: 3,
  handCounts: { ana: 3, rui: 5, eva: 0 },
  turnId: 'rui',
  lastPlay: { playerId: 'ana', count: 2 },
  pileCount: 2,
  reveal: null,
  winnerId: null,
  leaderboard: [
    { playerId: 'ana', score: 3, gained: 0 },
    { playerId: 'rui', score: 1, gained: 0 },
    { playerId: 'eva', score: 0, gained: 0 },
  ],
  ...overrides,
});

const renderView = (overrides: Partial<LiarsHostView>) =>
  render(
    <LiarsHost
      game={{ update: { serverTime: Date.now(), view: view(overrides) }, receivedAt: Date.now() }}
      lobby={lobby}
    />,
  );

describe('LiarsHost', () => {
  it('announces the table card for a new hand', () => {
    renderView({ phase: 'deal', lastPlay: null });
    expect(screen.getByRole('heading', { name: 'This hand: Queens!' })).toBeInTheDocument();
    expect(screen.getByLabelText('Table card')).toHaveTextContent('Q');
  });

  it('shows face-down cards, the claim, and whose turn it is', () => {
    renderView({});
    expect(screen.getByRole('heading', { name: 'Ana says: 2 Queens' })).toBeInTheDocument();
    expect(
      within(screen.getByLabelText('Cards on the table')).getAllByRole('listitem'),
    ).toHaveLength(2);
    const seats = within(screen.getByRole('list', { name: 'Players' })).getAllByRole('listitem');
    expect(seats[1]).toHaveClass('turn');
    expect(seats[1]).toHaveTextContent('Rui❤️5 cards');
    expect(seats[2]).toHaveClass('out');
  });

  it('flips the cards and says who lost a life', () => {
    renderView({
      phase: 'reveal',
      turnId: null,
      reveal: {
        playerId: 'ana',
        cards: [
          { id: 1, rank: 'Q' },
          { id: 2, rank: 'K' },
        ],
        callerId: 'rui',
        lied: true,
        loserId: 'ana',
        eliminated: false,
      },
    });
    expect(screen.getByText('Rui called Ana a liar!')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ana was lying!' })).toBeInTheDocument();
    expect(screen.getByText('Ana loses a life 💔')).toBeInTheDocument();
    const flipped = within(screen.getByLabelText('The cards')).getAllByRole('listitem');
    expect(flipped[0]!.firstChild).toHaveClass('honest');
    expect(flipped[1]!.firstChild).toHaveClass('wrong');
  });

  it('says when the game made the call and nobody lost a life', () => {
    renderView({
      phase: 'reveal',
      reveal: {
        playerId: 'ana',
        cards: [{ id: 1, rank: 'joker' }],
        callerId: null,
        lied: false,
        loserId: null,
        eliminated: false,
      },
    });
    expect(screen.getByRole('heading', { name: 'Ana told the truth!' })).toBeInTheDocument();
    expect(screen.getByText('Nobody loses a life')).toBeInTheDocument();
  });

  it('ends on the podium, with lives instead of points', () => {
    renderView({ phase: 'finished', endsAt: null, turnId: null, winnerId: 'ana' });
    expect(screen.getByText('🏆 Ana is the last one standing')).toBeInTheDocument();
    const podium = screen.getByRole('list', { name: 'Podium' });
    expect(podium).toHaveTextContent('Ana❤️❤️❤️');
    expect(podium).toHaveTextContent('EvaOut');
  });
});
