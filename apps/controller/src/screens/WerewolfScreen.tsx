import {
  werewolfRole,
  type PublicPlayer,
  type WerewolfPlayerView,
  type WerewolfRole,
} from '@couchwave/shared';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EndGameButton } from '../components/EndGameButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { colors } from '../theme';
import { useCountdown } from '../useCountdown';
import type { PlayerGame } from '../useController';

export interface WerewolfActions {
  /** Tonight's pick, or a vote (null skips). */
  pick: (targetId: string | null) => void;
  /** "Got it" on your role, or "let's vote". */
  ready: () => void;
}

interface WerewolfScreenProps {
  game: PlayerGame<WerewolfPlayerView>;
  players: PublicPlayer[];
  connected: boolean;
  isLeader: boolean;
  actions: WerewolfActions;
  onEnd: () => void;
  onPlayAgain: () => void;
}

/** What each role does at night. Everyone picks someone, so nobody stands out. */
const NIGHT_TASKS: Record<WerewolfRole, { title: string; hint: string }> = {
  werewolf: {
    title: '🐺 Who do you want to eat?',
    hint: 'The werewolves must agree on one victim.',
  },
  seer: { title: '🔮 Who do you want to look into?', hint: "You'll see if they're a werewolf." },
  doctor: {
    title: '💉 Who do you want to protect?',
    hint: 'They survive if the werewolves pick them. Not the same one two nights in a row.',
  },
  villager: {
    title: '🤔 Who do you suspect?',
    hint: 'Just for you: picking someone keeps the werewolves guessing who is who.',
  },
};

/** Werewolf on the phone: your secret role, the night's pick and the village vote. */
export function WerewolfScreen({
  game,
  players,
  connected,
  isLeader,
  actions,
  onEnd,
  onPlayAgain,
}: WerewolfScreenProps) {
  const { view, serverTime } = game.update;
  const msLeft = useCountdown(view.endsAt, serverTime, game.receivedAt);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'Player';
  const timed = ['roles', 'night', 'day', 'vote'].includes(view.phase);

  if (view.phase === 'finished') {
    const won = (view.winner === 'wolves') === (view.role === 'werewolf');
    return (
      <ScrollView contentContainerStyle={styles.centered}>
        <Text style={styles.eyebrow}>Game over</Text>
        <Text style={styles.big}>
          {view.winner === 'wolves' ? '🐺 The werewolves win!' : '🎉 The village wins!'}
        </Text>
        <Text style={won ? styles.good : styles.muted}>
          {won ? 'Your team won!' : 'Your team lost. Better luck next time!'}
        </Text>
        <RoleList view={view} players={players} />
        {isLeader ? (
          <>
            <BigButton label="Play again" disabled={!connected} onPress={onPlayAgain} />
            <Pressable accessibilityRole="button" disabled={!connected} onPress={onEnd}>
              <Text style={styles.linkText}>Back to the games</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.muted}>Waiting for the host to pick the next game…</Text>
        )}
      </ScrollView>
    );
  }

  const header = (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>
        {view.phase === 'roles'
          ? 'Your role'
          : view.phase === 'night'
            ? `Night ${view.round}`
            : `Day ${view.round}`}
      </Text>
      {timed && (
        <Text style={styles.timer} accessibilityLabel="Seconds left">
          {Math.ceil(msLeft / 1000)}s
        </Text>
      )}
      {isLeader && <EndGameButton onEnd={onEnd} />}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {header}
      {/* Keyed so the role card hides itself again on every new phase */}
      <View style={styles.body} key={`${view.phase}-${view.round}`}>
        {!view.alive ? (
          <Dead view={view} players={players} />
        ) : (
          <Phase
            view={view}
            players={players}
            nameOf={nameOf}
            connected={connected}
            actions={actions}
          />
        )}
      </View>
    </ScrollView>
  );
}

function Phase({
  view,
  players,
  nameOf,
  connected,
  actions,
}: {
  view: WerewolfPlayerView;
  players: PublicPlayer[];
  nameOf: (id: string) => string;
  connected: boolean;
  actions: WerewolfActions;
}) {
  const waiting = (
    <Text style={styles.muted}>
      Waiting for the others… ({view.readyCount}/{view.aliveIds.length})
    </Text>
  );

  switch (view.phase) {
    case 'roles':
      return (
        <>
          <Text style={styles.title}>Your secret role</Text>
          <RoleCard view={view} nameOf={nameOf} startShown={false} />
          {view.ready ? (
            waiting
          ) : (
            <BigButton label="Got it" disabled={!connected} onPress={actions.ready} />
          )}
        </>
      );

    case 'night': {
      const seen =
        view.role === 'seer' ? view.seerResults.find((r) => r.night === view.round) : null;
      if (seen) {
        return (
          <>
            <Text style={styles.title}>🔮 The truth about {nameOf(seen.targetId)}</Text>
            <Text
              style={[styles.verdict, seen.isWerewolf ? styles.bad : styles.good]}
              accessibilityRole="alert"
            >
              {seen.isWerewolf ? 'is a werewolf! 🐺' : 'is not a werewolf.'}
            </Text>
            <Text style={styles.muted}>Keep it to yourself… or find a clever way to tell.</Text>
            <SeerNotes
              view={{ ...view, seerResults: view.seerResults.filter((r) => r !== seen) }}
              nameOf={nameOf}
            />
          </>
        );
      }
      const task = NIGHT_TASKS[view.role];
      return (
        <>
          <Text style={styles.title}>{task.title}</Text>
          <Text style={styles.muted}>{task.hint}</Text>
          <Targets
            view={view}
            players={players}
            connected={connected}
            onPick={actions.pick}
            note={(id) =>
              view.packPicks
                .filter((pick) => pick.targetId === id)
                .map((pick) => `🐺 ${nameOf(pick.voterId)}`)
                .join('  ')
            }
          />
          {view.myPick && view.role !== 'seer' && (
            <Text style={styles.muted}>Changed your mind? Tap someone else.</Text>
          )}
          <RolePeek view={view} nameOf={nameOf} />
        </>
      );
    }

    case 'day':
      return (
        <>
          <Text style={styles.big}>☀️ Talk it over</Text>
          <Text style={styles.muted}>Who's acting suspicious? Say it out loud!</Text>
          {view.ready ? (
            waiting
          ) : (
            <BigButton label="Ready to vote" disabled={!connected} onPress={actions.ready} />
          )}
          <RolePeek view={view} nameOf={nameOf} />
        </>
      );

    case 'vote':
      return (
        <>
          <Text style={styles.title}>🗳️ Who should leave the village?</Text>
          <Text style={styles.muted}>
            {view.voted ? 'Vote counted. You can still change it.' : 'Tap someone to vote.'}
          </Text>
          <Targets view={view} players={players} connected={connected} onPick={actions.pick} />
          <Pressable
            accessibilityRole="radio"
            aria-checked={view.voted && view.myPick === null}
            disabled={!connected}
            onPress={() => actions.pick(null)}
            style={[styles.target, view.voted && view.myPick === null && styles.targetOn]}
          >
            <Text style={styles.targetName}>🤷 Skip the vote</Text>
          </Pressable>
          <RolePeek view={view} nameOf={nameOf} />
        </>
      );

    case 'dawn':
    case 'verdict':
      return (
        <>
          <Text style={styles.big}>👀 Look at the TV!</Text>
          <Text style={styles.muted}>
            {view.phase === 'dawn' ? 'What happened last night?' : 'The votes are in.'}
          </Text>
          <RolePeek view={view} nameOf={nameOf} />
        </>
      );

    case 'finished':
      return null;
  }
}

/** The players you can pick, as big buttons. `note` adds a line under a name. */
function Targets({
  view,
  players,
  connected,
  onPick,
  note,
}: {
  view: WerewolfPlayerView;
  players: PublicPlayer[];
  connected: boolean;
  onPick: (id: string) => void;
  note?: (id: string) => string;
}) {
  const picked = view.phase === 'vote' ? view.voted && view.myPick : view.myPick;
  return (
    <View style={styles.targets}>
      {view.targets.map((id) => {
        const player = players.find((p) => p.id === id);
        const extra = note?.(id);
        return (
          <Pressable
            key={id}
            accessibilityRole="radio"
            aria-checked={picked === id}
            disabled={!connected}
            onPress={() => onPick(id)}
            style={({ pressed }) => [
              styles.target,
              picked === id && styles.targetOn,
              pressed && styles.pressed,
            ]}
          >
            {player && <PlayerAvatar avatar={player.avatar} size={40} />}
            <View style={styles.targetText}>
              <Text style={styles.targetName}>{player?.name ?? 'Player'}</Text>
              {extra ? <Text style={styles.small}>{extra}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Your role, hidden until you tap it, so the person next to you can't see. */
function RoleCard({
  view,
  nameOf,
  startShown,
}: {
  view: WerewolfPlayerView;
  nameOf: (id: string) => string;
  startShown: boolean;
}) {
  const [shown, setShown] = useState(startShown);
  const role = werewolfRole(view.role);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={shown ? 'Hide my role' : 'Show my role'}
      onPress={() => setShown(!shown)}
      style={[styles.card, shown && styles.cardShown]}
    >
      {shown ? (
        <>
          <Text style={styles.cardEmoji}>{role.emoji}</Text>
          <Text style={styles.cardName}>{role.name}</Text>
          <Text style={styles.muted}>{role.goal}</Text>
          {view.packIds.length > 0 && (
            <Text style={styles.pack}>Your pack: {view.packIds.map(nameOf).join(', ')}</Text>
          )}
          <SeerNotes view={view} nameOf={nameOf} />
          <Text style={styles.small}>Tap to hide</Text>
        </>
      ) : (
        <>
          <Text style={styles.cardEmoji}>🃏</Text>
          <Text style={styles.cardName}>Tap to see your role</Text>
          <Text style={styles.small}>Make sure nobody is looking!</Text>
        </>
      )}
    </Pressable>
  );
}

/** A small "my role" button that opens the card, for later in the game. */
function RolePeek({ view, nameOf }: { view: WerewolfPlayerView; nameOf: (id: string) => string }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <View style={styles.peek}>
      <RoleCard view={view} nameOf={nameOf} startShown />
      <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.link}>
        <Text style={styles.linkText}>Close</Text>
      </Pressable>
    </View>
  ) : (
    <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.link}>
      <Text style={styles.linkText}>🃏 My role</Text>
    </Pressable>
  );
}

/** The seer's notebook: everyone they've looked into. */
function SeerNotes({ view, nameOf }: { view: WerewolfPlayerView; nameOf: (id: string) => string }) {
  if (view.seerResults.length === 0) return null;
  return (
    <View style={styles.notes} aria-label="What you've seen">
      {view.seerResults.map((result) => (
        <Text key={result.targetId} style={result.isWerewolf ? styles.bad : styles.muted}>
          Night {result.night}: {nameOf(result.targetId)}{' '}
          {result.isWerewolf ? 'is a werewolf 🐺' : 'is not a werewolf'}
        </Text>
      ))}
    </View>
  );
}

function Dead({ view, players }: { view: WerewolfPlayerView; players: PublicPlayer[] }) {
  return (
    <>
      <Text style={styles.big}>👻 You're dead</Text>
      <Text style={styles.muted}>
        No more talking, but you can watch. Here's everyone's role. Don't spoil it!
      </Text>
      <RoleList view={view} players={players} />
    </>
  );
}

/** Everyone's role, for the dead and at the end. */
function RoleList({ view, players }: { view: WerewolfPlayerView; players: PublicPlayer[] }) {
  return (
    <View style={styles.roles} aria-label="Everyone's role">
      {view.playerIds.map((id) => {
        const player = players.find((p) => p.id === id);
        const role = view.knownRoles[id];
        const alive = view.aliveIds.includes(id);
        return (
          <View key={id} style={[styles.roleRow, !alive && styles.deadRow]}>
            {player && <PlayerAvatar avatar={player.avatar} size={32} />}
            <Text style={styles.targetName}>
              {alive ? '' : '💀 '}
              {player?.name ?? 'Player'}
            </Text>
            {role && (
              <Text style={styles.roleName}>
                {werewolfRole(role).emoji} {werewolfRole(role).name}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

function BigButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    gap: 12,
  },
  body: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 12,
  },
  centered: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  timer: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  big: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  muted: {
    color: colors.muted,
    textAlign: 'center',
  },
  small: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
  },
  good: {
    color: '#46d39a',
    fontWeight: '700',
    textAlign: 'center',
  },
  bad: {
    color: colors.danger,
    fontWeight: '700',
    textAlign: 'center',
  },
  verdict: {
    fontSize: 28,
  },
  card: {
    alignItems: 'center',
    gap: 8,
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardShown: {
    borderColor: colors.warning,
  },
  cardEmoji: {
    fontSize: 72,
  },
  cardName: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  pack: {
    color: colors.danger,
    fontWeight: '700',
    textAlign: 'center',
  },
  notes: {
    gap: 4,
  },
  peek: {
    gap: 4,
  },
  targets: {
    gap: 8,
  },
  target: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  targetOn: {
    borderColor: colors.accent,
    backgroundColor: '#2e2366',
  },
  targetText: {
    flex: 1,
    gap: 2,
  },
  targetName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  roles: {
    alignSelf: 'stretch',
    gap: 6,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  deadRow: {
    opacity: 0.5,
  },
  roleName: {
    marginLeft: 'auto',
    color: colors.warning,
    fontWeight: '700',
  },
  button: {
    alignSelf: 'stretch',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  buttonText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  link: {
    alignSelf: 'center',
    padding: 8,
  },
  linkText: {
    color: colors.muted,
    fontWeight: '600',
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
