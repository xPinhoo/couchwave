import type { LobbyState } from '@couchwave/shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Lobby } from './Lobby';

const lobby = (players: string[]): LobbyState => ({
  roomCode: 'WXYZ',
  status: 'lobby',
  maxPlayers: 8,
  players: players.map((name, i) => ({ id: `p${i}`, name, connected: true })),
});

const renderLobby = (
  state: LobbyState,
  onStart: () => Promise<string | null> = vi.fn<() => Promise<string | null>>(async () => null),
) => render(<Lobby lobby={state} controllerUrl="http://play.test" onStart={onStart} />);

describe('Lobby', () => {
  it('shows the room code and the join link', () => {
    renderLobby(lobby([]));

    expect(screen.getByLabelText('Room code')).toHaveTextContent('WXYZ');
    expect(screen.getByText('http://play.test/?room=WXYZ')).toBeInTheDocument();
    expect(screen.getByText('Waiting for players…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start trivia' })).not.toBeInTheDocument();
  });

  it('lists the players who joined', () => {
    renderLobby(lobby(['Ana', 'Rui']));
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
    renderLobby(state);

    const [ana, rui] = within(screen.getByRole('region', { name: 'Players' })).getAllByRole(
      'listitem',
    );
    expect(ana).toHaveClass('away');
    expect(ana).toHaveTextContent('Anareconnecting…');
    expect(rui).not.toHaveClass('away');
  });

  it('starts the game and shows an error if the server refuses', async () => {
    const onStart = vi.fn<() => Promise<string | null>>(async () => 'NOT_ENOUGH_PLAYERS');
    renderLobby(lobby(['Ana']), onStart);

    fireEvent.click(screen.getByRole('button', { name: 'Start trivia' }));
    expect(onStart).toHaveBeenCalledOnce();
    expect(
      await screen.findByText("Couldn't start the game (NOT_ENOUGH_PLAYERS)."),
    ).toBeInTheDocument();
  });
});
