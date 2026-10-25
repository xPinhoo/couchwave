import { PLAYER_NAME_MAX_LENGTH, ROOM_CODE_LENGTH } from '@couchwave/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';

interface JoinScreenProps {
  initialRoomCode: string;
  joining: boolean;
  error?: string;
  onJoin: (roomCode: string, name: string) => void;
}

export function JoinScreen({ initialRoomCode, joining, error, onJoin }: JoinScreenProps) {
  const [roomCode, setRoomCode] = useState(initialRoomCode.toUpperCase());
  const [name, setName] = useState('');
  const canJoin = roomCode.length === ROOM_CODE_LENGTH && name.trim().length > 0 && !joining;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Couchwave</Text>

      <Text style={styles.label}>Room code</Text>
      <TextInput
        style={[styles.input, styles.codeInput]}
        value={roomCode}
        onChangeText={(text) => setRoomCode(text.toUpperCase())}
        maxLength={ROOM_CODE_LENGTH}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="ABCD"
        placeholderTextColor={colors.border}
      />

      <Text style={styles.label}>Your name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        maxLength={PLAYER_NAME_MAX_LENGTH}
        autoCorrect={false}
        placeholder="Ana"
        placeholderTextColor={colors.border}
        returnKeyType="go"
        onSubmitEditing={() => canJoin && onJoin(roomCode, name)}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        disabled={!canJoin}
        onPress={() => onJoin(roomCode, name)}
        style={({ pressed }) => [
          styles.button,
          !canJoin && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>{joining ? 'Joining…' : 'Join'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 32,
  },
  label: {
    color: colors.muted,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 2,
    borderRadius: 12,
    color: colors.text,
    fontSize: 22,
    padding: 14,
    marginBottom: 16,
  },
  codeInput: {
    fontSize: 32,
    letterSpacing: 12,
    textAlign: 'center',
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 8,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
});
