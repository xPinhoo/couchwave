import { presetAvatar, type Avatar } from '@couchwave/shared';
import { Image, StyleSheet, Text, View } from 'react-native';

interface PlayerAvatarProps {
  avatar: Avatar;
  size?: number;
}

/** A preset (emoji on a coloured circle) or the player's selfie, always round. */
export function PlayerAvatar({ avatar, size = 40 }: PlayerAvatarProps) {
  const circle = { width: size, height: size, borderRadius: size / 2 };

  if (avatar.kind === 'photo') {
    return <Image source={{ uri: avatar.dataUrl }} style={[styles.base, circle]} />;
  }

  const preset = presetAvatar(avatar.id);
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
