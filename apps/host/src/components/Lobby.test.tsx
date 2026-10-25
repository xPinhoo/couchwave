import type { LobbyState } from '@couchwave/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Lobby } from './Lobby';

const lobby = (players: string[]): LobbyState => ({
  roomCode: 'WXYZ',
  maxPlayers: 8,
  players: players.map((name, i) => ({ id: `p${i}`, name, connected: true })),
});

describe('Lobby', () => {
  it('shows the room code and the join link', () => {
    render(<Lobby lobby={lobby([])} controllerUrl="http://play.test" />);

    expect(screen.getByLabelText('Room code')).toHaveTextContent('WXYZ');
    expect(screen.getByText('http://play.test/?room=WXYZ')).toBeInTheDocument();
    expect(screen.getByText('Waiting for players…')).toBeInTheDocument();
  });

  it('lists the players who joined', () => {
    render(<Lobby lobby={lobby(['Ana', 'Rui'])} controllerUrl="http://play.test" />);
    const players = screen.getByRole('region', { name: 'Players' });

    expect(within(players).getByText('Players 2/8')).toBeInTheDocument();
    expect(
      within(players)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Ana', 'Rui']);
    expect(screen.queryByText('Waiting for players…')).not.toBeInTheDocument();
  });

  it('keeps the seat of a disconnected player and marks it as reconnecting', () => {
    const state = lobby(['Ana', 'Rui']);
    state.players[0]!.connected = false;
    render(<Lobby lobby={state} controllerUrl="http://play.test" />);

    const [ana, rui] = within(screen.getByRole('region', { name: 'Players' })).getAllByRole(
      'listitem',
    );
    expect(ana).toHaveClass('away');
    expect(ana).toHaveTextContent('Anareconnecting…');
    expect(rui).not.toHaveClass('away');
  });
});
