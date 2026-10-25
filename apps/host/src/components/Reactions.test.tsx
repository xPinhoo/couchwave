import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { player } from '../test/fixtures';
import { Reactions } from './Reactions';

describe('Reactions', () => {
  it("floats each reaction with the sender's avatar", () => {
    const { container } = render(
      <Reactions
        players={[player('ana', 'Ana', { avatar: { kind: 'preset', id: 'frog' } })]}
        reactions={[
          { key: 1, playerId: 'ana', emoji: '🎉' },
          { key: 2, playerId: 'ana', emoji: '🔥' },
        ]}
      />,
    );

    const floating = container.querySelectorAll('.reaction');
    expect(floating).toHaveLength(2);
    expect(floating[0]).toHaveTextContent('🎉🐸Ana sent');
    expect(screen.getAllByText('Ana sent')).toHaveLength(2);
  });

  it('still shows reactions from players who just left', () => {
    const { container } = render(
      <Reactions players={[]} reactions={[{ key: 1, playerId: 'gone', emoji: '😂' }]} />,
    );
    expect(container.querySelector('.reaction')).toHaveTextContent('😂');
  });
});
