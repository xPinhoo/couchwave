import { avatarArtUrl, presetAvatar, type Avatar } from '@couchwave/shared';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';

interface PlayerAvatarProps {
  avatar: Avatar;
  size?: number;
}

/** A preset (a drawing on a coloured circle) or the player's selfie, always round. */
export function PlayerAvatar({ avatar, size = 40 }: PlayerAvatarProps) {
  const circle = { width: size, height: size, borderRadius: size / 2 };

  if (avatar.kind === 'photo') {
    return <Image source={{ uri: avatar.dataUrl }} style={[styles.base, circle]} />;
  }

  const preset = presetAvatar(avatar.id);
  // React Native's Image can't draw SVG, so the native apps show the preset's emoji instead
  if (Platform.OS === 'web') {
    return (
      <Image
        source={{ uri: avatarArtUrl(preset) }}
        style={[styles.base, circle, { backgroundColor: preset.color }]}
      />
    );
  }

  return (
    <View style={[styles.base, circle, { backgroundColor: preset.color }]}>
      <Text style={{ fontSize: size * 0.55 }}>{preset.emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
