import type { WerewolfHostView } from '@couchwave/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { lobbyState, player } from '../test/fixtures';
import { WerewolfHost } from './WerewolfHost';

const ids = ['ana', 'rui', 'eva', 'ivo'];
const lobby = lobbyState({
  status: 'playing',
  players: [player('ana', 'Ana'), player('rui', 'Rui'), player('eva', 'Eva'), player('ivo', 'Ivo')],
});

const view = (overrides: Partial<WerewolfHostView>): WerewolfHostView => ({
  game: 'werewolf',
  phase: 'roles',
  round: 1,
  endsAt: Date.now() + 20_000,
  playerIds: ids,
  aliveIds: ids,
  readyIds: [],
  votedIds: [],
  nightDoneCount: 0,
  roleCounts: { werewolf: 1, seer: 1, doctor: 0, villager: 2 },
  knownRoles: {},
  dawn: null,
  verdict: null,
  winner: null,
  ...overrides,
});

const renderView = (overrides: Partial<WerewolfHostView>) =>
  render(
    <WerewolfHost
      game={{ update: { serverTime: Date.now(), view: view(overrides) }, receivedAt: Date.now() }}
      lobby={lobby}
    />,
  );

describe('WerewolfHost', () => {
  it('lists the roles in play, and who has seen theirs', () => {
    renderView({ readyIds: ['rui'] });
    expect(screen.getByRole('heading', { name: 'Check your secret role' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Roles in this game' })).toHaveTextContent(
      '1 × Werewolf',
    );
    expect(screen.getByText('1/4 have seen their role')).toBeInTheDocument();
  });

  it('shows only how many are done at night, not who', () => {
    renderView({ phase: 'night', nightDoneCount: 2 });
    expect(screen.getByText('Night 1', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('2/4 done')).toBeInTheDocument();
    expect(screen.queryByLabelText('Done')).not.toBeInTheDocument();
  });

  it('announces the night’s victim and their role', () => {
    renderView({
      phase: 'dawn',
      aliveIds: ['rui', 'eva', 'ivo'],
      knownRoles: { ana: 'seer' },
      dawn: { outcome: 'killed', victimId: 'ana', role: 'seer' },
    });
    expect(screen.getByText('was eaten by the werewolves.', { exact: false })).toHaveTextContent(
      'Ana was eaten',
    );
    expect(screen.getByText('They were', { exact: false })).toHaveTextContent('the 🔮 Seer');
    const village = screen.getByRole('list', { name: 'The village' });
    expect(within(village).getAllByLabelText('Dead')).toHaveLength(1);
  });

  it('says nobody died when the doctor saved them', () => {
    renderView({ phase: 'dawn', dawn: { outcome: 'saved', victimId: null, role: null } });
    expect(screen.getByRole('heading', { name: 'Nobody died last night!' })).toBeInTheDocument();
    expect(screen.getByText('The doctor got there just in time.')).toBeInTheDocument();
  });

  it('shows who voted for whom, and who is out', () => {
    renderView({
      phase: 'verdict',
      verdict: {
        votes: [
          { voterId: 'ana', targetId: 'rui' },
          { voterId: 'eva', targetId: 'rui' },
          { voterId: 'rui', targetId: null },
        ],
        eliminatedId: 'rui',
        role: 'werewolf',
      },
    });
    expect(screen.getByRole('heading', { name: 'Rui is out!' })).toBeInTheDocument();
    const rows = within(screen.getByRole('list', { name: 'Votes' })).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual(['Rui2', '🤷 Skip1']);
  });

  it('names the winners at the end', () => {
    renderView({
      phase: 'finished',
      winner: 'wolves',
      knownRoles: { ana: 'werewolf', rui: 'seer', eva: 'villager', ivo: 'villager' },
    });
    expect(screen.getByRole('heading', { name: 'The werewolves win!' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'The village' })).toHaveTextContent('🐺 Werewolf');
  });
});
