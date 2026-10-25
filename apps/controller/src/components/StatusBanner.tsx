import { StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

interface StatusBannerProps {
  /** Our own connection. */
  connected: boolean;
  /** The TV screen's connection. */
  screenConnected: boolean;
}

/** Explains why things may have stopped moving: our connection, or the TV's. */
export function StatusBanner({ connected, screenConnected }: StatusBannerProps) {
  const message = !connected
    ? 'Connection lost — reconnecting…'
    : !screenConnected
      ? 'The TV screen disconnected — waiting for it to come back…'
      : null;
  if (!message) return null;

  return (
    <Text style={styles.banner} accessibilityRole="alert">
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.warning,
    color: colors.bg,
    fontWeight: '700',
    textAlign: 'center',
    overflow: 'hidden',
  },
});
