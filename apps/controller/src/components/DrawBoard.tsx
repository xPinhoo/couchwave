import { DRAW_ASPECT } from '@couchwave/shared';
import { useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors } from '../theme';

/** Drawing needs the phone sideways; the native apps can't draw, and are locked upright. */
function useNeedsTurning() {
  const { width, height } = useWindowDimensions();
  return Platform.OS === 'web' && height > width;
}

/**
 * Shows `children` only while the phone is sideways, and `prompt` while it's upright.
 * The children stay mounted when hidden, so turning back and forth keeps the drawing.
 */
export function LandscapeOnly({ prompt, children }: { prompt: ReactNode; children: ReactNode }) {
  const upright = useNeedsTurning();
  return (
    <>
      {upright && prompt}
      <View style={[styles.fill, upright && styles.hidden]}>{children}</View>
    </>
  );
}

/** "Turn your phone sideways", with whatever the player needs to know meanwhile. */
export function TurnPhonePrompt({ children }: { children?: ReactNode }) {
  return (
    <View style={styles.prompt}>
      <Text style={styles.icon} aria-hidden>
        📱↻
      </Text>
      <Text style={styles.title}>Turn your phone sideways</Text>
      <Text style={styles.muted}>You get a much bigger canvas to draw on.</Text>
      {children}
      <Text style={styles.small}>Not turning? Switch off your phone's rotation lock.</Text>
    </View>
  );
}

/**
 * The drawing layout: the canvas as big as fits on the left, at the TV's 16:9 shape,
 * and a column of tools (`children`) on the right.
 */
export function DrawBoard({ canvas, children }: { canvas: ReactNode; children: ReactNode }) {
  const [area, setArea] = useState({ width: 0, height: 0 });
  const width = Math.min(area.width, area.height * DRAW_ASPECT);

  return (
    <View style={styles.board}>
      <View style={styles.area} onLayout={(event) => setArea(event.nativeEvent.layout)}>
        <View style={{ width, height: width / DRAW_ASPECT }}>{canvas}</View>
      </View>
      <ScrollView style={styles.side} contentContainerStyle={styles.sideContent}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
  prompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
  },
  icon: {
    color: colors.text,
    fontSize: 64,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  muted: {
    color: colors.muted,
    textAlign: 'center',
  },
  small: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  board: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 8,
  },
  area: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  side: {
    width: 212,
    flexGrow: 0,
  },
  sideContent: {
    gap: 8,
    paddingBottom: 8,
  },
});
