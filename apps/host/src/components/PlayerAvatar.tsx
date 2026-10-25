import { presetAvatar, type Avatar } from '@couchwave/shared';
import type { CSSProperties } from 'react';

interface PlayerAvatarProps {
  avatar: Avatar;
  size?: number;
}

/** A preset (emoji on a coloured circle) or the player's selfie, always round. */
export function PlayerAvatar({ avatar, size = 48 }: PlayerAvatarProps) {
  const style = { width: size, height: size } as CSSProperties;

  if (avatar.kind === 'photo') {
    return <img className="avatar" src={avatar.dataUrl} alt="" style={style} />;
  }

  const preset = presetAvatar(avatar.id);
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{ ...style, background: preset.color, fontSize: size * 0.55 }}
    >
      {preset.emoji}
    </span>
  );
}
