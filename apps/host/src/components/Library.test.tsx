import { GAMES } from '@couchwave/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { lobbyState, player } from '../test/fixtures';
import { Library } from './Library';

describe('Library', () => {
  it('lists every game, highlights the selected one and marks the unavailable ones', () => {
    render(
      <Library
        lobby={lobbyState({ status: 'library', selectedGame: 1, players: [player('ana', 'Ana')] })}
      />,
    );

    const cards = within(screen.getByRole('list', { name: 'Games' })).getAllByRole('listitem');
    expect(cards).toHaveLength(GAMES.length);
    expect(cards[1]).toHaveAttribute('aria-current', 'true');
    expect(cards[0]).not.toHaveAttribute('aria-current');
    expect(cards[1]).toHaveTextContent('Coming soon');
    expect(cards[0]).not.toHaveTextContent('Coming soon');
  });

  it('says who is choosing', () => {
    render(<Library lobby={lobbyState({ status: 'library', players: [player('ana', 'Ana')] })} />);
    expect(screen.getByText(/Ana is choosing on their phone/)).toBeInTheDocument();
  });
});
