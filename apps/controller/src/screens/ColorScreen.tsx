import { hexToHsl, hslToHex, type ColorPlayerView, type Hsl } from '@couchwave/shared';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ColorPicker } from '../components/ColorPicker';
import { EndGameButton } from '../components/EndGameButton';
import { GameOver } from '../components/GameOver';
import { colors } from '../theme';
import { useCountdown } from '../useCountdown';
import type { PlayerGame } from '../useController';

export interface ColorActions {
  /** The colour mixed so far; fire and forget. */
  pick: (color: string) => void;
  lock: () => void;
}

interface ColorScreenProps {
  game: PlayerGame<ColorPlayerView>;
  connected: boolean;
  isLeader: boolean;
  actions: ColorActions;
  onEnd: () => void;
  onPlayAgain: () => void;
}

/** A strong mid-tone to start from, so the palette opens in full colour. */
const START: Hsl = { h: 180, s: 100, l: 50 };

function verdict(accuracy: number) {
  if (accuracy >= 98) return '🎯 Spot on!';
  if (accuracy >= 85) return '🔥 So close!';
  if (accuracy >= 60) return '👍 Not bad';
  if (accuracy >= 25) return '🤔 Hmm, not really';
  return '🙈 Way off';
}

/** Guess the Color on the phone: mix the colour, lock it in, and see how close you got. */
export function ColorScreen({
  game,
  connected,
  isLeader,
  actions,
  onEnd,
  onPlayAgain,
}: ColorScreenProps) {
  const { view, serverTime } = game.update;
  const msLeft = useCountdown(view.endsAt, serverTime, game.receivedAt);

  if (view.phase === 'finished') {
    return (
      <GameOver
        rank={view.rank}
        score={view.score}
        connected={connected}
        isLeader={isLeader}
        onPlayAgain={onPlayAgain}
        onEnd={onEnd}
      />
    );
  }

  const standing = `${view.score} pts · #${view.rank} of ${view.playerCount}`;

  if (view.phase === 'countdown') {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>{view.totalRounds} rounds</Text>
        <Text style={styles.big}>Get ready!</Text>
        <Text style={styles.countdown} accessibilityLabel="Starting in">
          {Math.ceil(msLeft / 1000)}
        </Text>
        <Text style={styles.muted}>The pictures are on the TV. Mix the colours here!</Text>
      </View>
    );
  }

  if (view.phase === 'reveal') {
    const { result, answer } = view;
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>{view.name}</Text>
        <View style={styles.compare}>
          <Swatch color={result?.color ?? null} label="Yours" />
          <Swatch color={answer} label="The real one" />
        </View>
        <Text style={styles.big}>{result?.color ? verdict(result.accuracy) : "⏱ Time's up"}</Text>
        {result && <Text style={styles.points}>+{result.points}</Text>}
        {result?.color && <Text style={styles.muted}>{result.accuracy}% close</Text>}
        <Text style={styles.muted}>{standing}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          Round {view.round}/{view.totalRounds}
        </Text>
        <Text style={styles.timer} accessibilityLabel="Seconds left">
          {Math.ceil(msLeft / 1000)}s
        </Text>
        {isLeader && <EndGameButton onEnd={onEnd} />}
      </View>
      {/* Keyed so each round starts with a fresh palette */}
      <Mixer key={view.round} view={view} connected={connected} actions={actions} />
    </View>
  );
}

function Mixer({
  view,
  connected,
  actions,
}: {
  view: ColorPlayerView;
  connected: boolean;
  actions: ColorActions;
}) {
  // A reloaded phone gets back what it had mixed
  const [hsl, setHsl] = useState(() => (view.myColor ? hexToHsl(view.myColor) : START));
  const [touched, setTouched] = useState(view.myColor !== null);
  const latest = useRef(hsl);
  const hex = hslToHex(hsl);

  return (
    <>
      <Text style={styles.title}>{view.name}</Text>
      <ColorPicker
        value={hsl}
        disabled={view.locked || !connected}
        onChange={(next) => {
          latest.current = next;
          setHsl(next);
          setTouched(true);
        }}
        // Whatever was sent last counts when time runs out
        onRelease={() => actions.pick(hslToHex(latest.current))}
      />
      <View style={styles.result}>
        <View
          style={[styles.preview, touched ? { backgroundColor: hex } : styles.previewEmpty]}
          accessibilityLabel="Your colour"
        />
        <Text style={styles.hex} accessibilityLabel="Hex code">
          {touched ? hex.toUpperCase() : '#······'}
        </Text>
      </View>
      {view.locked ? (
        <Text style={styles.locked}>
          ✓ Locked in. Waiting for the others… ({view.lockedCount}/{view.playerCount})
        </Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={!touched || !connected}
          onPress={actions.lock}
          style={({ pressed }) => [
            styles.button,
            (!touched || !connected) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.buttonText}>Lock it in</Text>
        </Pressable>
      )}
    </>
  );
}

function Swatch({ color, label }: { color: string | null; label: string }) {
  return (
    <View style={styles.swatchBox}>
      <View
        style={[styles.swatch, color ? { backgroundColor: color } : styles.previewEmpty]}
        accessibilityLabel={label}
      />
      <Text style={styles.small}>{label}</Text>
      <Text style={styles.code}>{color ? color.toUpperCase() : 'None'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 10,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  timer: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  big: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  countdown: {
    color: colors.accent,
    fontSize: 120,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  muted: {
    color: colors.muted,
    textAlign: 'center',
  },
  small: {
    color: colors.muted,
    fontSize: 13,
  },
  points: {
    color: '#46d39a',
    fontSize: 36,
    fontWeight: '800',
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  preview: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
  },
  previewEmpty: {
    backgroundColor: colors.surface,
  },
  hex: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  code: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  locked: {
    padding: 18,
    color: '#46d39a',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  compare: {
    flexDirection: 'row',
    gap: 16,
  },
  swatchBox: {
    alignItems: 'center',
    gap: 4,
  },
  swatch: {
    width: 120,
    height: 120,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
  },
  button: {
    alignSelf: 'stretch',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  buttonText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
