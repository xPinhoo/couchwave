import type { LobbyState } from '@couchwave/shared';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

interface LobbyScreenProps {
  playerId: string;
  lobby: LobbyState;
  /** False while our own connection is down and we are trying to get back in. */
  connected: boolean;
  /** Last error from a leader action, if any. */
  error: string | null;
  onStart: () => void;
  onKick: (playerId: string) => void;
}

export function LobbyScreen({
  playerId,
  lobby,
  connected,
  error,
  onStart,
  onKick,
}: LobbyScreenProps) {
  const me = lobby.players.find((p) => p.id === playerId);
  const isLeader = lobby.leaderId === playerId;
  const leader = lobby.players.find((p) => p.id === lobby.leaderId);
  // Kicking takes two taps: the first arms the button, the second confirms
  const [armedKick, setArmedKick] = useState<string | null>(null);

  useEffect(() => {
    if (!armedKick) return;
    const timeout = setTimeout(() => setArmedKick(null), 3000);
    return () => clearTimeout(timeout);
  }, [armedKick]);

  return (
    <View style={styles.container}>
      {!connected && (
        <Text style={styles.banner} accessibilityRole="alert">
          Connection lost — reconnecting…
        </Text>
      )}

      <Text style={styles.eyebrow}>Room {lobby.roomCode}</Text>
      <Text style={styles.title}>
        {isLeader ? `You're the host 👑` : `You're in, ${me?.name}!`}
      </Text>
      <Text style={styles.muted}>
        {isLeader
          ? 'Start the game when everyone has joined.'
          : `Waiting for ${leader?.name ?? 'the host'} to start the game…`}
      </Text>

      <View style={styles.players}>
        {lobby.players.map((player) => {
          const canKick = isLeader && player.id !== playerId;
          const armed = armedKick === player.id;
          return (
            <View
              key={player.id}
              style={[
                styles.player,
                player.id === playerId && styles.playerMe,
                !player.connected && styles.playerAway,
              ]}
            >
              <Text style={styles.playerName}>
                {player.id === lobby.leaderId ? '👑 ' : ''}
                {player.name}
              </Text>
              {canKick && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    armed ? `Confirm kicking ${player.name}` : `Kick ${player.name}`
                  }
                  disabled={!connected}
                  onPress={() => {
                    if (armed) {
                      setArmedKick(null);
                      onKick(player.id);
                    } else {
                      setArmedKick(player.id);
                    }
                  }}
                  style={[styles.kick, armed && styles.kickArmed]}
                >
                  <Text style={styles.kickText}>{armed ? 'Confirm' : 'Kick'}</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isLeader && (
        <Pressable
          accessibilityRole="button"
          disabled={!connected}
          onPress={onStart}
          style={({ pressed }) => [
            styles.start,
            pressed && styles.pressed,
            !connected && styles.disabled,
          ]}
        >
          <Text style={styles.startText}>Start trivia</Text>
        </Pressable>
      )}
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
  banner: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.warning,
    color: colors.bg,
    fontWeight: '700',
    textAlign: 'center',
    overflow: 'hidden',
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
    gap: 8,
  },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  playerMe: {
    borderColor: colors.accent,
  },
  playerAway: {
    opacity: 0.4,
  },
  playerName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  kick: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  kickArmed: {
    backgroundColor: colors.danger,
  },
  kickText: {
    color: colors.text,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
  },
  start: {
    marginTop: 16,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  startText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
