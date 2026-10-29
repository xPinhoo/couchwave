import {
  DRAW_ROUNDS_OPTIONS,
  DRAW_SECONDS_OPTIONS,
  TRIVIA_LENGTH_OPTIONS,
  TRIVIA_SECONDS_OPTIONS,
  TRIVIA_TOPICS,
  gameInfo,
  triviaTopic,
  type DrawOptions,
  type GameSetup,
  type LobbyState,
  type TriviaOptions,
} from '@couchwave/shared';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { StatusBanner } from '../components/StatusBanner';
import { colors } from '../theme';

interface SetupScreenProps {
  playerId: string;
  lobby: LobbyState;
  connected: boolean;
  error: string | null;
  onOptions: (options: TriviaOptions | DrawOptions) => void;
  onReady: (ready: boolean) => void;
  onCancel: () => void;
}

/**
 * Before a game starts. The host picks the settings and confirms (that's their Ready);
 * everyone else presses Ready. The game starts once everyone is ready.
 */
export function SetupScreen({
  playerId,
  lobby,
  connected,
  error,
  onOptions,
  onReady,
  onCancel,
}: SetupScreenProps) {
  const setup = lobby.setup;
  if (!setup) return null;

  const { readyIds } = setup;
  const game = gameInfo(setup.gameId);
  const isLeader = lobby.leaderId === playerId;
  const ready = readyIds.includes(playerId);
  const leader = lobby.players.find((p) => p.id === lobby.leaderId);
  const editing = isLeader && !ready;
  const connectedCount = lobby.players.filter((p) => p.connected).length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBanner connected={connected} screenConnected={lobby.screenConnected} />
      <Text style={styles.eyebrow}>{game.name}</Text>

      {editing ? (
        <>
          <Text style={styles.title}>Game settings</Text>

          {setup.gameId === 'trivia' ? (
            <TriviaSettings options={setup.options} onChange={onOptions} />
          ) : (
            <DrawSettings options={setup.options} onChange={onOptions} />
          )}

          <BigButton label="Confirm" disabled={!connected} onPress={() => onReady(true)} />
          <Pressable accessibilityRole="button" onPress={onCancel} style={styles.link}>
            <Text style={styles.linkText}>← Back to the games</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Summary setup={setup} />
          {isLeader ? (
            <>
              <Text style={styles.muted}>Settings confirmed. Waiting for everyone else…</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => onReady(false)}
                style={styles.link}
              >
                <Text style={styles.linkText}>✎ Edit settings</Text>
              </Pressable>
            </>
          ) : (
            <>
              {!readyIds.includes(lobby.leaderId ?? '') && (
                <Text style={styles.muted}>
                  {leader?.name ?? 'The host'} is choosing the settings…
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                aria-selected={ready}
                disabled={!connected}
                onPress={() => onReady(!ready)}
                style={({ pressed }) => [
                  styles.readyButton,
                  ready && styles.readyButtonOn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.readyText}>{ready ? '✓ Ready!' : 'Ready'}</Text>
              </Pressable>
              <Text style={styles.muted}>
                {ready ? 'Tap again if you need a moment.' : 'Tap when you are ready to play.'}
              </Text>
            </>
          )}
        </>
      )}

      {connectedCount < game.minPlayers && (
        <Text style={styles.warning}>
          {game.name} needs at least {game.minPlayers} players. Invite someone with room code{' '}
          {lobby.roomCode}!
        </Text>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.readyRow}>
        {lobby.players.map((player) => {
          const isReady = readyIds.includes(player.id);
          return (
            <View key={player.id} style={[styles.readyPlayer, !isReady && styles.notReady]}>
              <PlayerAvatar avatar={player.avatar} size={36} />
              <Text style={styles.readyName}>
                {isReady ? '✓ ' : ''}
                {player.name}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function TriviaSettings({
  options,
  onChange,
}: {
  options: TriviaOptions;
  onChange: (options: TriviaOptions) => void;
}) {
  const set = (change: Partial<TriviaOptions>) => onChange({ ...options, ...change });
  return (
    <>
      <Section label="Topic">
        {TRIVIA_TOPICS.map((topic) => (
          <Chip
            key={topic.id}
            label={`${topic.emoji} ${topic.name}`}
            selected={options.topic === topic.id}
            onPress={() => set({ topic: topic.id })}
          />
        ))}
      </Section>
      <Section label="Time per question">
        {TRIVIA_SECONDS_OPTIONS.map((seconds) => (
          <Chip
            key={seconds}
            label={`${seconds}s`}
            selected={options.secondsPerQuestion === seconds}
            onPress={() => set({ secondsPerQuestion: seconds })}
          />
        ))}
      </Section>
      <Section label="Questions">
        {TRIVIA_LENGTH_OPTIONS.map((count) => (
          <Chip
            key={count}
            label={String(count)}
            selected={options.questionCount === count}
            onPress={() => set({ questionCount: count })}
          />
        ))}
      </Section>
    </>
  );
}

function DrawSettings({
  options,
  onChange,
}: {
  options: DrawOptions;
  onChange: (options: DrawOptions) => void;
}) {
  const set = (change: Partial<DrawOptions>) => onChange({ ...options, ...change });
  return (
    <>
      <Section label="Time to draw">
        {DRAW_SECONDS_OPTIONS.map((seconds) => (
          <Chip
            key={seconds}
            label={`${seconds}s`}
            selected={options.secondsToDraw === seconds}
            onPress={() => set({ secondsToDraw: seconds })}
          />
        ))}
      </Section>
      <Section label="Rounds (everyone draws once per round)">
        {DRAW_ROUNDS_OPTIONS.map((rounds) => (
          <Chip
            key={rounds}
            label={String(rounds)}
            selected={options.rounds === rounds}
            onPress={() => set({ rounds })}
          />
        ))}
      </Section>
    </>
  );
}

function Summary({ setup }: { setup: GameSetup }) {
  if (setup.gameId === 'draw') {
    const { rounds, secondsToDraw } = setup.options;
    return (
      <View style={styles.summary}>
        <Text style={styles.summaryEmoji}>🎨</Text>
        <Text style={styles.title}>Draw & Guess</Text>
        <Text style={styles.muted}>
          {rounds} {rounds === 1 ? 'round' : 'rounds'} · {secondsToDraw}s to draw
        </Text>
      </View>
    );
  }

  const { options } = setup;
  const topic = triviaTopic(options.topic);
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryEmoji}>{topic.emoji}</Text>
      <Text style={styles.title}>{topic.name}</Text>
      <Text style={styles.muted}>
        {options.questionCount} questions · {options.secondsPerQuestion}s each
      </Text>
    </View>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      aria-checked={selected}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
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
      style={({ pressed }) => [styles.big, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Text style={styles.bigText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 14,
  },
  eyebrow: {
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  muted: {
    color: colors.muted,
    textAlign: 'center',
  },
  section: {
    gap: 8,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  chipText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  big: {
    marginTop: 8,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  bigText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  summary: {
    alignItems: 'center',
    gap: 4,
  },
  summaryEmoji: {
    fontSize: 64,
  },
  readyButton: {
    alignSelf: 'center',
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 90,
    backgroundColor: '#4a4560',
    marginTop: 8,
  },
  readyButtonOn: {
    backgroundColor: '#30a46c',
  },
  readyText: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  readyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
  },
  readyPlayer: {
    alignItems: 'center',
    gap: 4,
  },
  notReady: {
    opacity: 0.4,
  },
  readyName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  link: {
    alignSelf: 'center',
    padding: 8,
  },
  linkText: {
    color: colors.muted,
    fontWeight: '600',
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
  },
  warning: {
    color: colors.warning,
    textAlign: 'center',
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
