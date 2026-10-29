import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import type { DrawingPadProps } from './DrawingPad.types';

/**
 * The native apps don't have a drawing pad yet: the controller is played in the browser,
 * which uses DrawingPad.web.tsx. Guessing works everywhere.
 */
export function DrawingPad(_props: DrawingPadProps) {
  return (
    <View style={styles.pad}>
      <Text style={styles.text}>
        Drawing works in the browser version of the controller. Open it on your phone's browser to
        take your turn!
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    aspectRatio: 4 / 3,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  text: {
    color: colors.muted,
    textAlign: 'center',
  },
});
