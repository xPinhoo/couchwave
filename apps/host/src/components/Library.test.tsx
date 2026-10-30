import { GAMES, gamesInCategory } from '@couchwave/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { lobbyState, player } from '../test/fixtures';
import { Library } from './Library';

const indexOf = (id: string) => GAMES.findIndex((game) => game.id === id);

describe('Library', () => {
  it("shows the selected game's category tab and only that category's games", () => {
    render(
      <Library
        lobby={lobbyState({
          status: 'library',
          selectedGame: indexOf('bluff'),
          players: [player('ana', 'Ana')],
        })}
      />,
    );

    const tabs = within(screen.getByRole('list', { name: 'Categories' })).getAllByRole('listitem');
    expect(tabs.find((tab) => tab.getAttribute('aria-current'))).toHaveTextContent('Creative');

    const cards = within(screen.getByRole('list', { name: 'Games' })).getAllByRole('listitem');
    expect(cards).toHaveLength(gamesInCategory('creative').length);
    expect(cards[0]).toHaveTextContent('Draw & Guess');
    expect(cards[1]).toHaveAttribute('aria-current', 'true');
    expect(cards[1]).toHaveTextContent('Coming soon');
    expect(cards[0]).not.toHaveTextContent('Coming soon');
  });

  it('puts the logo, room code and everyone in the navbar, with a crown on the leader', () => {
    render(
      <Library
        lobby={lobbyState({
          status: 'library',
          roomCode: 'WXYZ',
          leaderId: 'ana',
          players: [player('ana', 'Ana'), player('rui', 'Rui')],
        })}
      />,
    );

    expect(screen.getByRole('img', { name: 'Couchwave' })).toBeInTheDocument();
    expect(screen.getByLabelText('Room code')).toHaveTextContent('WXYZ');
    const players = within(screen.getByRole('list', { name: 'Players' })).getAllByRole('listitem');
    expect(players.map((li) => li.getAttribute('aria-label'))).toEqual(['Ana', 'Rui']);
    expect(within(players[0]!).getByRole('img', { name: 'Host' })).toBeInTheDocument();
    expect(within(players[1]!).queryByRole('img', { name: 'Host' })).toBeNull();
  });

  it('pops in players who join while the menu is up, not those already there', () => {
    const lobby = lobbyState({ status: 'library', players: [player('ana', 'Ana')] });
    const { rerender } = render(<Library lobby={lobby} />);
    rerender(<Library lobby={{ ...lobby, players: [...lobby.players, player('rui', 'Rui')] }} />);

    expect(screen.getByRole('listitem', { name: 'Ana' })).not.toHaveClass('arrived');
    expect(screen.getByRole('listitem', { name: 'Rui' })).toHaveClass('arrived');
  });

  it('says who is choosing', () => {
    render(<Library lobby={lobbyState({ status: 'library', players: [player('ana', 'Ana')] })} />);
    expect(screen.getByText(/Ana is choosing on their phone/)).toBeInTheDocument();
  });
});
