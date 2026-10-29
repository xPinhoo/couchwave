import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { lobbyState, player } from '../test/fixtures';
import { SetupScreen } from './SetupScreen';

const players = [player('ana', 'Ana'), player('rui', 'Rui'), player('eva', 'Eva')];
const setupLobby = (readyIds: string[]) =>
  lobbyState({
    status: 'setup',
    players,
    setup: {
      gameId: 'trivia',
      options: { topic: 'cinema', secondsPerQuestion: 30, questionCount: 20 },
      readyIds,
    },
  });

describe('SetupScreen', () => {
  it("shows the host's settings", () => {
    render(<SetupScreen lobby={setupLobby([])} />);

    const settings = screen.getByLabelText('Settings');
    expect(settings).toHaveTextContent('Topic🎬 Cinema');
    expect(settings).toHaveTextContent('Time per question30s');
    expect(settings).toHaveTextContent('Questions20');
  });

  it('says the host is still choosing until they confirm', () => {
    render(<SetupScreen lobby={setupLobby(['rui'])} />);
    expect(screen.getByText('Ana is choosing the settings…')).toBeInTheDocument();
  });

  it('ticks off who is ready and counts the rest', () => {
    render(<SetupScreen lobby={setupLobby(['ana', 'rui'])} />);

    const [ana, rui, eva] = within(
      screen.getByRole('region', { name: 'Ready check' }),
    ).getAllByRole('listitem');
    expect(ana).toHaveClass('ready');
    expect(within(rui!).getByLabelText('Ready')).toBeInTheDocument();
    expect(eva).not.toHaveClass('ready');
    expect(screen.getByText('Waiting for everyone to press Ready (2/3)')).toBeInTheDocument();
  });

  it('shows the Draw & Guess settings, and asks for more players when needed', () => {
    render(
      <SetupScreen
        lobby={lobbyState({
          status: 'setup',
          players: [player('ana', 'Ana')],
          setup: { gameId: 'draw', options: { secondsToDraw: 90, rounds: 2 }, readyIds: [] },
        })}
      />,
    );

    expect(screen.getByRole('heading')).toHaveTextContent('Draw & Guess');
    expect(screen.getByLabelText('Settings')).toHaveTextContent('Time to draw90sRounds2');
    expect(
      screen.getByText('Draw & Guess needs at least 2 players. Join with room code WXYZ'),
    ).toBeInTheDocument();
  });
});
