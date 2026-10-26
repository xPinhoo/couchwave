import {
  AVATAR_PRESETS,
  PLAYER_NAME_MAX_LENGTH,
  ROOM_CODE_LENGTH,
  type Avatar,
} from '@couchwave/shared';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { pickAvatarPhoto } from '../avatarPhoto';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { colors } from '../theme';

interface JoinScreenProps {
  initialRoomCode: string;
  joining: boolean;
  error?: string;
  onJoin: (roomCode: string, name: string, avatar: Avatar) => void;
}

function randomPreset(): Avatar {
  const preset = AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)]!;
  return { kind: 'preset', id: preset.id };
}

const sameAvatar = (a: Avatar, b: Avatar) =>
  a.kind === 'preset' && b.kind === 'preset' ? a.id === b.id : a === b;

export function JoinScreen({ initialRoomCode, joining, error, onJoin }: JoinScreenProps) {
  const [roomCode, setRoomCode] = useState(initialRoomCode.toUpperCase());
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<Avatar>(randomPreset);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const canJoin = roomCode.length === ROOM_CODE_LENGTH && name.trim().length > 0 && !joining;

  // The photo tiles are never locked while picking: some browsers don't report a closed
  // file chooser, and a locked tile would then stay disabled for good.
  async function choosePhoto(source: 'camera' | 'library') {
    setPhotoError(null);
    const result = await pickAvatarPhoto(source);
    if (result.status === 'ok') setAvatar(result.avatar);
    if (result.status === 'error') setPhotoError(result.message);
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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

      <Text style={styles.label}>You</Text>
      <View style={styles.identity}>
        <PlayerAvatar avatar={avatar} size={64} />
        <TextInput
          style={[styles.input, styles.nameInput]}
          value={name}
          onChangeText={setName}
          maxLength={PLAYER_NAME_MAX_LENGTH}
          autoCorrect={false}
          placeholder="Your name"
          placeholderTextColor={colors.border}
          returnKeyType="go"
          onSubmitEditing={() => canJoin && onJoin(roomCode, name, avatar)}
        />
      </View>

      <Text style={styles.label}>Pick an avatar</Text>
      <View style={styles.grid} accessibilityRole="radiogroup">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take a selfie"
          onPress={() => void choosePhoto('camera')}
          style={[styles.tile, styles.photoTile, avatar.kind === 'photo' && styles.tileSelected]}
        >
          <Text style={styles.photoIcon}>📷</Text>
          <Text style={styles.photoLabel}>Selfie</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose a photo"
          onPress={() => void choosePhoto('library')}
          style={[styles.tile, styles.photoTile]}
        >
          <Text style={styles.photoIcon}>🖼️</Text>
          <Text style={styles.photoLabel}>Photo</Text>
        </Pressable>
        {AVATAR_PRESETS.map((preset) => {
          const option: Avatar = { kind: 'preset', id: preset.id };
          const selected = sameAvatar(avatar, option);
          return (
            <Pressable
              key={preset.id}
              accessibilityRole="radio"
              accessibilityLabel={preset.id}
              aria-checked={selected}
              onPress={() => setAvatar(option)}
              style={[styles.tile, selected && styles.tileSelected]}
            >
              <PlayerAvatar avatar={option} size={48} />
            </Pressable>
          );
        })}
      </View>
      {photoError ? <Text style={styles.error}>{photoError}</Text> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        disabled={!canJoin}
        onPress={() => onJoin(roomCode, name, avatar)}
        style={({ pressed }) => [
          styles.button,
          !canJoin && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>{joining ? 'Joining…' : 'Join'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 24,
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
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  nameInput: {
    flex: 1,
    // Text inputs have an intrinsic width on web; let this one shrink next to the avatar
    minWidth: 0,
    marginBottom: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tile: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileSelected: {
    borderColor: colors.text,
  },
  photoTile: {
    backgroundColor: colors.surface,
  },
  photoIcon: {
    fontSize: 22,
  },
  photoLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
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
