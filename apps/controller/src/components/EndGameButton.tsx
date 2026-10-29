import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

/** The host's "End game". It takes two taps, so a stray tap can't ruin it for everyone. */
export function EndGameButton({ onEnd }: { onEnd: () => void }) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timeout = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timeout);
  }, [confirming]);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => (confirming ? onEnd() : setConfirming(true))}
      style={[styles.button, confirming && styles.armed]}
    >
      <Text style={styles.text}>{confirming ? 'Tap to confirm' : 'End game'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  armed: {
    borderColor: colors.danger,
    backgroundColor: colors.danger,
  },
  text: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
});
