import { avatarArtUrl, presetAvatar, type Avatar } from '@couchwave/shared';
import type { CSSProperties } from 'react';

interface PlayerAvatarProps {
  avatar: Avatar;
  size?: number;
}

/** A preset (a drawing on a coloured circle) or the player's selfie, always round. */
export function PlayerAvatar({ avatar, size = 48 }: PlayerAvatarProps) {
  const style = { width: size, height: size } as CSSProperties;

  if (avatar.kind === 'photo') {
    return <img className="avatar" src={avatar.dataUrl} alt="" style={style} />;
  }

  const preset = presetAvatar(avatar.id);
  return (
    <img
      className="avatar"
      src={avatarArtUrl(preset)}
      alt=""
      data-avatar={preset.id}
      style={{ ...style, background: preset.color }}
    />
  );
}
