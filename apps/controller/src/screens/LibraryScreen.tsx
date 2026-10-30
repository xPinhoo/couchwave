import {
  GAME_CATEGORIES,
  GAMES,
  focusedGame,
  moveLibraryCursor,
  pressLibraryOk,
  type LibraryDirection,
  type LobbyState,
  type Reaction,
} from '@couchwave/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ReactionBar } from '../components/ReactionBar';
import { StatusBanner } from '../components/StatusBanner';
import { colors } from '../theme';

interface LibraryScreenProps {
  playerId: string;
  lobby: LobbyState;
  connected: boolean;
  error: string | null;
  onMove: (direction: LibraryDirection) => void;
  onSelect: () => void;
  onBack: () => void;
  onReact: (emoji: Reaction) => void;
}

/**
 * While the host picks a game on the TV, their phone is the remote: the arrows move between
 * the tabs and game cards, OK opens a tab or plays a game. Everyone else sees what's focused
 * and can keep sending reactions.
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
  const { focus } = lobby.library;
  const tab = focus.area === 'tabs' ? GAME_CATEGORIES[focus.index] : undefined;
  const game = GAMES[focusedGame(lobby.library) ?? -1];

  // Buttons are only enabled when they would do something: no wrapping around at the edges
  const canMove = (direction: LibraryDirection) =>
    moveLibraryCursor(lobby.library, direction) !== lobby.library;
  const ok = pressLibraryOk(lobby.library);
  const canOk = ok.kind === 'tab' || (ok.kind === 'game' && !!GAMES[ok.gameIndex]?.available);

  const arrow = (direction: LibraryDirection, label: string) => (
    <PadButton
      label={label}
      accessibilityLabel={direction[0]!.toUpperCase() + direction.slice(1)}
      disabled={!connected || !canMove(direction)}
      onPress={() => onMove(direction)}
    />
  );

  return (
    <View style={styles.container}>
      <StatusBanner connected={connected} screenConnected={lobby.screenConnected} />

      <Text style={styles.eyebrow}>{tab ? 'Category' : 'Choose a game'}</Text>
      <Text style={styles.emoji}>{tab?.emoji ?? game?.emoji}</Text>
      <Text style={styles.title}>{tab?.name ?? game?.name}</Text>
      <Text style={styles.muted}>
        {tab
          ? ok.kind === 'tab'
            ? 'Press OK to see these games'
            : 'Showing these games'
          : game?.available
            ? game.description
            : 'Coming soon'}
      </Text>

      {isLeader ? (
        <>
          <View style={styles.pad}>
            {arrow('up', '▲')}
            <View style={styles.padRow}>
              {arrow('left', '◀')}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="OK"
                disabled={!connected || !canOk}
                onPress={onSelect}
                style={({ pressed }) => [
                  styles.select,
                  (!connected || !canOk) && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.selectText}>OK</Text>
              </Pressable>
              {arrow('right', '▶')}
            </View>
            {arrow('down', '▼')}
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
  disabled,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.arrow,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
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
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  padRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
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
