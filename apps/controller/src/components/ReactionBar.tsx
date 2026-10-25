import { REACTIONS, type Reaction } from '@couchwave/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

interface ReactionBarProps {
  disabled?: boolean;
  onReact: (emoji: Reaction) => void;
}

/** Emoji buttons that make reactions float up the TV while everyone waits. */
export function ReactionBar({ disabled, onReact }: ReactionBarProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Send a reaction to the TV</Text>
      <View style={styles.row}>
        {REACTIONS.map((emoji) => (
          <Pressable
            key={emoji}
            accessibilityRole="button"
            accessibilityLabel={`React ${emoji}`}
            disabled={disabled}
            onPress={() => onReact(emoji)}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    marginTop: 8,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  pressed: {
    transform: [{ scale: 1.25 }],
    backgroundColor: colors.border,
  },
  emoji: {
    fontSize: 26,
  },
});
