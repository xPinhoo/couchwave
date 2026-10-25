import { CHOICE_STYLES } from '@couchwave/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { useCountdown } from '../useCountdown';
import type { PlayerGame } from '../useController';

interface TriviaScreenProps {
  game: PlayerGame;
  /** False while our own connection is down. */
  connected: boolean;
  onAnswer: (choice: number) => void;
}

const ordinal = (n: number) => `#${n}`;

export function TriviaScreen({ game, connected, onAnswer }: TriviaScreenProps) {
  const { view, serverTime } = game.update;
  const msLeft = useCountdown(view.endsAt, serverTime, game.receivedAt);
  const standing = `${view.score} pts · ${ordinal(view.rank)} of ${view.playerCount}`;

  if (view.phase === 'finished') {
    return (
      <View style={styles.centered}>
        <Text style={styles.eyebrow}>Game over</Text>
        <Text style={styles.big}>
          {view.rank === 1 ? '🏆 You won!' : `You finished ${ordinal(view.rank)}`}
        </Text>
        <Text style={styles.muted}>{view.score} points</Text>
      </View>
    );
  }

  if (view.phase === 'reveal') {
    const result = view.lastResult;
    const missed = view.myChoice === null;
    return (
      <View style={[styles.centered, result?.correct ? styles.correctBg : styles.wrongBg]}>
        <Text style={styles.big}>
          {result?.correct ? '✓ Correct!' : missed ? "⏱ Time's up" : '✗ Wrong'}
        </Text>
        {result?.correct && <Text style={styles.points}>+{result.points}</Text>}
        <Text style={styles.muted}>{standing}</Text>
      </View>
    );
  }

  const header = (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>
        Question {view.round}/{view.totalRounds}
      </Text>
      <Text style={styles.timer}>{Math.ceil(msLeft / 1000)}s</Text>
    </View>
  );

  if (view.myChoice !== null) {
    const style = CHOICE_STYLES[view.myChoice];
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centered}>
          <View style={[styles.locked, { backgroundColor: style?.color }]}>
            <Text style={styles.lockedSymbol}>{style?.symbol}</Text>
            <Text style={styles.choiceText}>{view.choices[view.myChoice]}</Text>
          </View>
          <Text style={styles.big}>Answer locked in</Text>
          <Text style={styles.muted}>Waiting for the others…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      <Text style={styles.muted}>Look at the big screen and pick your answer</Text>
      <View style={styles.grid}>
        {view.choices.map((choice, i) => {
          const style = CHOICE_STYLES[i];
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={choice}
              disabled={!connected}
              onPress={() => onAnswer(i)}
              style={({ pressed }) => [
                styles.choice,
                { backgroundColor: style?.color },
                pressed && styles.pressed,
                !connected && styles.disabled,
              ]}
            >
              <Text style={styles.choiceSymbol}>{style?.symbol}</Text>
              <Text style={styles.choiceText}>{choice}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  big: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
  },
  points: {
    color: colors.text,
    fontSize: 48,
    fontWeight: '800',
  },
  muted: {
    color: colors.muted,
    textAlign: 'center',
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  choice: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 16,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
  disabled: {
    opacity: 0.4,
  },
  choiceSymbol: {
    color: colors.text,
    fontSize: 40,
  },
  choiceText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  locked: {
    alignItems: 'center',
    gap: 8,
    padding: 24,
    borderRadius: 16,
    minWidth: 200,
  },
  lockedSymbol: {
    color: colors.text,
    fontSize: 56,
  },
  correctBg: {
    backgroundColor: '#1d5a3f',
  },
  wrongBg: {
    backgroundColor: '#5a1d24',
  },
});
