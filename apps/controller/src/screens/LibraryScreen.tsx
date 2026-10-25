import { GAMES, type LobbyState, type Reaction } from '@couchwave/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ReactionBar } from '../components/ReactionBar';
import { StatusBanner } from '../components/StatusBanner';
import { colors } from '../theme';

interface LibraryScreenProps {
  playerId: string;
  lobby: LobbyState;
  connected: boolean;
  error: string | null;
  onMove: (delta: -1 | 1) => void;
  onSelect: () => void;
  onBack: () => void;
  onReact: (emoji: Reaction) => void;
}

/**
 * While the host picks a game on the TV, their phone is the joystick (◀ ▶ + Select).
 * Everyone else sees what's highlighted and can keep sending reactions.
 */
export function LibraryScreen({
  playerId,
  lobby,
  connected,
  error,
  onMove,
  onSelect,
  onBack,
  onReact,
}: LibraryScreenProps) {
  const isLeader = lobby.leaderId === playerId;
  const leader = lobby.players.find((p) => p.id === lobby.leaderId);
  const game = GAMES[lobby.selectedGame];

  return (
    <View style={styles.container}>
      <StatusBanner connected={connected} screenConnected={lobby.screenConnected} />

      <Text style={styles.eyebrow}>{isLeader ? 'Choose a game' : 'Games library'}</Text>
      <Text style={styles.emoji}>{game?.emoji}</Text>
      <Text style={styles.title}>{game?.name}</Text>
      <Text style={styles.muted}>{game?.available ? game.description : 'Coming soon'}</Text>

      {isLeader ? (
        <>
          <View style={styles.pad}>
            <PadButton label="◀" accessibilityLabel="Previous game" onPress={() => onMove(-1)} />
            <Pressable
              accessibilityRole="button"
              disabled={!connected || !game?.available}
              onPress={onSelect}
              style={({ pressed }) => [
                styles.select,
                (!connected || !game?.available) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.selectText}>Play</Text>
            </Pressable>
            <PadButton label="▶" accessibilityLabel="Next game" onPress={() => onMove(1)} />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}>
            <Text style={styles.backText}>← Back to the lobby</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.muted}>
            {leader?.name ?? 'The host'} is choosing a game… look at the TV!
          </Text>
          <ReactionBar disabled={!connected} onReact={onReact} />
        </>
      )}
    </View>
  );
}

function PadButton({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
    >
      <Text style={styles.arrowText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  eyebrow: {
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
  },
  emoji: {
    fontSize: 72,
    textAlign: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  muted: {
    color: colors.muted,
    textAlign: 'center',
  },
  pad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 24,
  },
  arrow: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 38,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  arrowText: {
    color: colors.text,
    fontSize: 30,
  },
  select: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 55,
    backgroundColor: colors.accent,
  },
  selectText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  pressed: {
    transform: [{ scale: 0.92 }],
  },
  disabled: {
    opacity: 0.35,
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
  },
  back: {
    alignSelf: 'center',
    marginTop: 16,
    padding: 8,
  },
  backText: {
    color: colors.muted,
    fontWeight: '600',
  },
});
