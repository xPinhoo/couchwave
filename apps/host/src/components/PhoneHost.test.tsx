import type { PhoneHostView, PhoneReveal, SketchOp } from '@couchwave/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { lobbyState, player } from '../test/fixtures';
import { PhoneHost } from './PhoneHost';

const lobby = lobbyState({
  status: 'playing',
  players: [player('ana', 'Ana'), player('rui', 'Rui'), player('eva', 'Eva')],
});

const dot: SketchOp = { kind: 'pen', color: 0, size: 0, points: [500, 500] };
const summary = { ownerId: 'ana', original: 'A cat on a bus', final: 'A dog in a car' };

const view = (overrides: Partial<PhoneHostView>): PhoneHostView => ({
  game: 'phone',
  phase: 'write',
  step: 1,
  totalSteps: 3,
  endsAt: Date.now() + 30_000,
  playerIds: ['ana', 'rui', 'eva'],
  doneIds: [],
  reveal: null,
  summaries: [],
  ...overrides,
});

const reveal = (overrides: Partial<PhoneReveal>): PhoneReveal => ({
  chain: 0,
  totalChains: 3,
  ownerId: 'ana',
  entry: 0,
  entryCount: 3,
  current: { kind: 'text', playerId: 'ana', text: 'A cat on a bus', source: 'typed' },
  previousText: null,
  summary,
  ...overrides,
});

const renderView = (overrides: Partial<PhoneHostView>) =>
  render(
    <PhoneHost
      game={{ update: { serverTime: Date.now(), view: view(overrides) }, receivedAt: Date.now() }}
      lobby={lobby}
    />,
  );

describe('PhoneHost', () => {
  it('shows the task of the step and who is done, but nobody’s work', () => {
    renderView({ phase: 'draw', step: 2, doneIds: ['rui'] });
    expect(screen.getByRole('heading', { name: 'Draw the phrase you got' })).toBeInTheDocument();
    expect(screen.getByText('Step 2/3', { exact: false })).toBeInTheDocument();
    expect(screen.getAllByLabelText('Done')).toHaveLength(1);
    expect(screen.getByText('1/3 done')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Drawing' })).not.toBeInTheDocument();
  });

  it('reveals the first phrase, then each drawing with the phrase it came from', () => {
    const { rerender } = renderView({ phase: 'reveal', reveal: reveal({}) });
    expect(screen.getByText('wrote:', { exact: false })).toHaveTextContent('Ana wrote:');
    expect(screen.getByText('“A cat on a bus”')).toBeInTheDocument();

    const drawing = view({
      phase: 'reveal',
      reveal: reveal({
        entry: 1,
        current: { kind: 'sketch', playerId: 'rui', ops: [dot] },
        previousText: 'A cat on a bus',
      }),
    });
    rerender(
      <PhoneHost
        game={{ update: { serverTime: Date.now(), view: drawing }, receivedAt: Date.now() }}
        lobby={lobby}
      />,
    );
    expect(screen.getByText('and drew this:', { exact: false })).toHaveTextContent(
      'Rui got “A cat on a bus” and drew this:',
    );
    expect(screen.getByRole('img', { name: 'Drawing' })).toHaveAttribute('data-ops', '1');
  });

  it('says when someone ran out of time to guess', () => {
    renderView({
      phase: 'reveal',
      reveal: reveal({
        entry: 2,
        current: { kind: 'text', playerId: 'eva', text: '', source: 'missed' },
      }),
    });
    expect(screen.getByText('ran out of time', { exact: false })).toHaveTextContent('Eva');
  });

  it('ends each chain on its original and final phrase, and the game on all of them', () => {
    const { unmount } = renderView({
      phase: 'reveal',
      reveal: reveal({ entry: 3, current: null }),
    });
    expect(screen.getByText('“A dog in a car”')).toBeInTheDocument();
    expect(screen.getByText('😂 Not quite…')).toBeInTheDocument();
    unmount();

    renderView({ phase: 'finished', endsAt: null, summaries: [summary] });
    expect(screen.getByRole('list', { name: 'Every phrase' })).toHaveTextContent(
      'Ana“A cat on a bus”→“A dog in a car”',
    );
  });
});
