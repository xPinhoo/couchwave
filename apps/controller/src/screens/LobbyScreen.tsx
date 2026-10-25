import type { LobbyState } from '@couchwave/shared';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

interface LobbyScreenProps {
  playerId: string;
  lobby: LobbyState;
}

export function LobbyScreen({ playerId, lobby }: LobbyScreenProps) {
  const me = lobby.players.find((p) => p.id === playerId);

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Room {lobby.roomCode}</Text>
      <Text style={styles.title}>You're in, {me?.name}!</Text>
      <Text style={styles.muted}>Look at the big screen — the game starts soon.</Text>

      <View style={styles.players}>
        {lobby.players.map((player) => (
          <Text key={player.id} style={[styles.player, player.id === playerId && styles.playerMe]}>
            {player.name}
          </Text>
        ))}
      </View>
    </View>
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
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
  },
  muted: {
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 24,
  },
  players: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  player: {
    color: colors.text,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 2,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  playerMe: {
    borderColor: colors.accent,
  },
});
