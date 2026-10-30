import { gamesInCategory } from '@couchwave/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { lobbyState, player } from '../test/fixtures';
import { Library } from './Library';

describe('Library', () => {
  it("shows the open tab's games and the remote's focus", () => {
    // Creative is open, the focus is on its second game (Bluff)
    render(
      <Library
        lobby={lobbyState({
          status: 'library',
          library: { category: 1, focus: { area: 'games', index: 1 } },
          players: [player('ana', 'Ana')],
        })}
      />,
    );

    const tabs = within(screen.getByRole('list', { name: 'Categories' })).getAllByRole('listitem');
    expect(tabs[1]).toHaveClass('shown');
    expect(tabs.some((tab) => tab.hasAttribute('aria-current'))).toBe(false);

    const cards = within(screen.getByRole('list', { name: 'Games' })).getAllByRole('listitem');
    expect(cards).toHaveLength(gamesInCategory(1).length);
    expect(cards[0]).toHaveTextContent('Draw & Guess');
    expect(cards[1]).toHaveAttribute('aria-current', 'true');
    expect(cards[1]).toHaveTextContent('Coming soon');
    expect(cards[0]).not.toHaveTextContent('Coming soon');
  });

  it('only switches tabs on OK: the focus can sit on a tab other than the one shown', () => {
    render(
      <Library
        lobby={lobbyState({
          status: 'library',
          library: { category: 0, focus: { area: 'tabs', index: 1 } },
        })}
      />,
    );

    const tabs = within(screen.getByRole('list', { name: 'Categories' })).getAllByRole('listitem');
    expect(tabs[0]).toHaveClass('shown');
    expect(tabs[1]).toHaveAttribute('aria-current', 'true');
    const cards = within(screen.getByRole('list', { name: 'Games' })).getAllByRole('listitem');
    expect(cards.map((card) => card.querySelector('h2')?.textContent)).toEqual([
      'Quick-fire trivia',
    ]);
    expect(cards[0]).not.toHaveAttribute('aria-current');
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
