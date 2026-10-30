import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { lobbyState, player } from '../test/fixtures';
import { Lobby } from './Lobby';

const renderLobby = (players: ReturnType<typeof player>[]) =>
  render(<Lobby lobby={lobbyState({ players })} controllerUrl="http://play.test" />);

const seats = () =>
  within(screen.getByRole('region', { name: 'Players' }))
    .getAllByRole('listitem')
    .filter((li) => li.textContent);

describe('Lobby', () => {
  it('shows the room code and the join link, and explains who becomes host', () => {
    renderLobby([]);

    expect(screen.getByLabelText('Room code')).toHaveTextContent('WXYZ');
    expect(screen.getByText('http://play.test/?room=WXYZ')).toBeInTheDocument();
    expect(
      screen.getByText('Waiting for players… the first to join becomes the host 👑'),
    ).toBeInTheDocument();
  });

  it('shows each player with their avatar and crowns the host', () => {
    const photo = { kind: 'photo', dataUrl: 'data:image/jpeg;base64,AAAA' } as const;
    renderLobby([
      player('ana', 'Ana', { avatar: { kind: 'preset', id: 'pilot' } }),
      player('rui', 'Rui', { avatar: photo }),
    ]);

    const [ana, rui] = seats();
    expect(ana).toHaveTextContent('👑Ana');
    expect(ana?.querySelector('img')).toHaveAttribute('data-avatar', 'pilot');
    expect(rui?.querySelector('img')).toHaveAttribute('src', photo.dataUrl);
    expect(
      screen.getByText('Waiting for Ana to start the game from their phone…'),
    ).toBeInTheDocument();
  });

  it('has no controls: the TV only displays', () => {
    renderLobby([player('ana', 'Ana')]);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps the seat of a disconnected player and marks it as reconnecting', () => {
    renderLobby([player('ana', 'Ana'), player('rui', 'Rui', { connected: false })]);

    const [ana, rui] = seats();
    expect(rui).toHaveClass('away');
    expect(rui).toHaveTextContent('Ruireconnecting…');
    expect(ana).not.toHaveClass('away');
  });
});
