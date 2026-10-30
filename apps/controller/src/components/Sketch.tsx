import { DRAW_ASPECT } from '@couchwave/shared';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import type { SketchPadProps, SketchViewProps } from './Sketch.types';

/**
 * The native apps can't draw yet: the controller is played in the browser, which uses
 * Sketch.web.tsx. Writing and guessing work everywhere.
 */
export function SketchPad({ info, footer }: SketchPadProps) {
  return (
    <View style={styles.column}>
      {info}
      <Placeholder text="Drawing works in the browser version of the controller. Open it on your phone's browser to take your turn!" />
      {footer}
    </View>
  );
}

export function SketchView(_props: SketchViewProps) {
  return <Placeholder text="Open the controller in your phone's browser to see the drawing." />;
}

function Placeholder({ text }: { text: string }) {
  return (
    <View style={styles.pad}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    gap: 12,
    padding: 16,
  },
  pad: {
    aspectRatio: DRAW_ASPECT,
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
