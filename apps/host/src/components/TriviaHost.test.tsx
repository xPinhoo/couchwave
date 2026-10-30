import type { TriviaHostView } from '@couchwave/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { lobbyState, player } from '../test/fixtures';
import { TriviaHost } from './TriviaHost';

const players = [
  player('ana', 'Ana', { avatar: { kind: 'preset', id: 'cat' } }),
  player('rui', 'Rui', { avatar: { kind: 'preset', id: 'dino' } }),
  player('eva', 'Eva', { avatar: { kind: 'preset', id: 'dino' } }),
  player('tom', 'Tom', { avatar: { kind: 'preset', id: 'student' } }),
];
const lobby = lobbyState({ status: 'playing', players });

function view(overrides: Partial<TriviaHostView> = {}): TriviaHostView {
  return {
    game: 'trivia',
    topic: 'geography',
    phase: 'question',
    round: 2,
    totalRounds: 10,
    prompt: 'What is the capital of Australia?',
    choices: ['Sydney', 'Canberra', 'Melbourne', 'Perth'],
    endsAt: 15_000,
    playerIds: ['ana', 'rui'],
    answeredIds: ['rui'],
    correctChoice: null,
    picks: null,
    leaderboard: [
      { playerId: 'rui', score: 1800, gained: 900 },
      { playerId: 'ana', score: 700, gained: -250 },
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
  it('shows the topic, question, choices and who has answered', () => {
    renderHost(view());

    expect(screen.getByText('🌍 Geography · Question 2/10')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'What is the capital of Australia?' }),
    ).toBeVisible();
    expect(
      within(screen.getByRole('list', { name: 'Choices' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['▲Sydney', '◆Canberra', '●Melbourne', '■Perth']);

    const [ana, rui] = within(screen.getByRole('list', { name: 'Who has answered' })).getAllByRole(
      'listitem',
    );
    expect(rui).toHaveClass('answered');
    expect(within(rui!).getByLabelText('Answered')).toBeInTheDocument();
    expect(ana).not.toHaveClass('answered');
    expect(screen.getByText('1/2 answered')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it("puts each player's avatar on the answer they picked during the reveal", () => {
    renderHost(
      view({
        phase: 'reveal',
        correctChoice: 1,
        picks: [
          { playerId: 'ana', choice: 0 },
          { playerId: 'rui', choice: 1 },
        ],
      }),
    );

    const choices = within(screen.getByRole('list', { name: 'Choices' })).getAllByRole('listitem');
    expect(choices[1]).toHaveClass('correct');
    expect(choices[0]).toHaveClass('dimmed');
    expect(within(choices[0]!).getByLabelText('1 picked this')).toHaveTextContent('');
    expect(within(choices[1]!).getByLabelText('1 picked this')).toHaveTextContent('');
    expect(within(choices[2]!).queryByLabelText(/picked this/)).not.toBeInTheDocument();
  });

  it('shows points won and lost on the leaderboard', () => {
    renderHost(view({ phase: 'reveal', correctChoice: 1, picks: [] }));
    expect(
      within(screen.getByRole('list', { name: 'Leaderboard' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Rui1800 +900', 'Ana700 −250']);
  });

  it('ends with a podium for the top 3 and a list for everyone else', () => {
    renderHost(
      view({
        phase: 'finished',
        endsAt: null,
        leaderboard: [
          { playerId: 'rui', score: 3000, gained: 0 },
          { playerId: 'ana', score: 2000, gained: 0 },
          { playerId: 'eva', score: 1000, gained: 0 },
          { playerId: 'tom', score: -200, gained: 0 },
        ],
      }),
    );

    // Second, first, third: the winner stands in the middle
    const podium = within(screen.getByRole('list', { name: 'Podium' })).getAllByRole('listitem');
    expect(podium.map((li) => li.querySelector('.podium-name')?.textContent)).toEqual([
      'Ana',
      'Rui',
      'Eva',
    ]);
    expect(within(podium[1]!).getByLabelText('Place 1')).toHaveTextContent('🏆');

    const rest = within(screen.getByRole('list', { name: 'Everyone else' })).getAllByRole(
      'listitem',
    );
    expect(rest.map((li) => li.textContent)).toEqual(['4Tom-200']);
    expect(screen.getByText('Ana can play again or pick another game')).toBeInTheDocument();
  });
});
