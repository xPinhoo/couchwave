import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

interface GameOverProps {
  rank: number;
  score: number;
  connected: boolean;
  /** The host can play again or go back to the games library. */
  isLeader: boolean;
  onPlayAgain: () => void;
  onEnd: () => void;
}

/** The end of any game, on the phone: your place and, for the host, what to do next. */
export function GameOver({ rank, score, connected, isLeader, onPlayAgain, onEnd }: GameOverProps) {
  return (
    <View style={styles.centered}>
      <Text style={styles.eyebrow}>Game over</Text>
      <Text style={styles.big}>{rank === 1 ? '🏆 You won!' : `You finished #${rank}`}</Text>
      <Text style={styles.muted}>{score} points</Text>
      {isLeader ? (
        <>
          <Pressable
            accessibilityRole="button"
            disabled={!connected}
            onPress={onPlayAgain}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>Play again</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={!connected} onPress={onEnd}>
            <Text style={styles.secondaryText}>Back to the games</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.muted}>Waiting for the host to pick the next game…</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  eyebrow: {
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  big: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
  },
  muted: {
    color: colors.muted,
    textAlign: 'center',
  },
  primary: {
    marginTop: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  primaryText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryText: {
    color: colors.muted,
    fontWeight: '600',
    padding: 8,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
});
