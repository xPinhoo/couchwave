import type { LobbyState, TriviaHostView } from '@couchwave/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TriviaHost } from './TriviaHost';

const lobby: LobbyState = {
  roomCode: 'WXYZ',
  status: 'playing',
  maxPlayers: 8,
  leaderId: 'ana',
  players: [
    { id: 'ana', name: 'Ana', connected: true },
    { id: 'rui', name: 'Rui', connected: true },
  ],
};

function view(overrides: Partial<TriviaHostView> = {}): TriviaHostView {
  return {
    game: 'trivia',
    phase: 'question',
    round: 2,
    totalRounds: 8,
    prompt: 'What is the capital of Australia?',
    choices: ['Sydney', 'Canberra', 'Melbourne', 'Perth'],
    endsAt: 15_000,
    answeredCount: 1,
    playerCount: 2,
    correctChoice: null,
    choiceCounts: null,
    leaderboard: [
      { playerId: 'rui', score: 1800, gained: 900 },
      { playerId: 'ana', score: 700, gained: 0 },
    ],
    ...overrides,
  };
}

const renderHost = (v: TriviaHostView) =>
  render(
    <TriviaHost
      game={{ update: { serverTime: 0, view: v }, receivedAt: Date.now() }}
      lobby={lobby}
    />,
  );

describe('TriviaHost', () => {
  it('shows the question, the choices and how many have answered', () => {
    renderHost(view());

    expect(screen.getByText('Question 2/8')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'What is the capital of Australia?' }),
    ).toBeVisible();
    expect(
      within(screen.getByRole('list', { name: 'Choices' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['▲Sydney', '◆Canberra', '●Melbourne', '■Perth']);
    expect(screen.getByText('1/2 answered')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Leaderboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('highlights the correct answer and shows the leaderboard during the reveal', () => {
    renderHost(view({ phase: 'reveal', correctChoice: 1, choiceCounts: [1, 1, 0, 0] }));

    const choices = within(screen.getByRole('list', { name: 'Choices' })).getAllByRole('listitem');
    expect(choices[1]).toHaveClass('correct');
    expect(choices[0]).toHaveClass('dimmed');
    expect(
      within(screen.getByRole('list', { name: 'Leaderboard' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Rui1800 +900', 'Ana700']);
  });

  it('shows the final scores and tells everyone the host can start another round', () => {
    renderHost(view({ phase: 'finished', endsAt: null }));

    const podium = within(screen.getByRole('list', { name: 'Final scores' })).getAllByRole(
      'listitem',
    );
    expect(podium[0]).toHaveTextContent('1Rui1800');
    expect(podium[0]).toHaveClass('winner');
    expect(screen.getByText('Ana can start another round from their phone')).toBeInTheDocument();
  });
});
