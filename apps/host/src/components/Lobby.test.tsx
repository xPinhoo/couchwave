import type { LobbyState } from '@couchwave/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Lobby } from './Lobby';

const lobby = (players: string[]): LobbyState => ({
  roomCode: 'WXYZ',
  status: 'lobby',
  maxPlayers: 8,
  players: players.map((name, i) => ({ id: `p${i}`, name, connected: true })),
  leaderId: players.length > 0 ? 'p0' : null,
});

const renderLobby = (state: LobbyState) =>
  render(<Lobby lobby={state} controllerUrl="http://play.test" />);

const seats = () =>
  within(screen.getByRole('region', { name: 'Players' }))
    .getAllByRole('listitem')
    .filter((li) => li.textContent);

describe('Lobby', () => {
  it('shows the room code and the join link, and explains who becomes host', () => {
    renderLobby(lobby([]));

    expect(screen.getByLabelText('Room code')).toHaveTextContent('WXYZ');
    expect(screen.getByText('http://play.test/?room=WXYZ')).toBeInTheDocument();
    expect(
      screen.getByText('Waiting for players… the first to join becomes the host 👑'),
    ).toBeInTheDocument();
  });

  it('crowns the leader and says who everyone is waiting for', () => {
    renderLobby(lobby(['Ana', 'Rui']));

    expect(seats().map((li) => li.textContent)).toEqual(['👑Ana', 'Rui']);
    expect(
      screen.getByText('Waiting for Ana to start the game from their phone…'),
    ).toBeInTheDocument();
  });

  it('has no controls: the TV only displays', () => {
    renderLobby(lobby(['Ana']));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps the seat of a disconnected player and marks it as reconnecting', () => {
    const state = lobby(['Ana', 'Rui']);
    state.players[1]!.connected = false;
    renderLobby(state);

    const [ana, rui] = seats();
    expect(rui).toHaveClass('away');
    expect(rui).toHaveTextContent('Ruireconnecting…');
    expect(ana).not.toHaveClass('away');
  });
});
