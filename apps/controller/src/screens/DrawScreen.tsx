import {
  DRAW_COLORS,
  DRAW_SIZES,
  GUESS_MAX_LENGTH,
  type DrawPlayerView,
  type PublicPlayer,
  type Stroke,
} from '@couchwave/shared';
import { useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { DrawBoard, LandscapeOnly, TurnPhonePrompt } from '../components/DrawBoard';
import { DrawingPad } from '../components/DrawingPad';
import type { DrawingPadHandle } from '../components/DrawingPad.types';
import { EndGameButton } from '../components/EndGameButton';
import { GameOver } from '../components/GameOver';
import { colors } from '../theme';
import { useCountdown } from '../useCountdown';
import type { PlayerGame } from '../useController';

export interface DrawActions {
  choose: (index: number) => void;
  guess: (text: string) => void;
  stroke: (stroke: Stroke) => void;
  undo: () => void;
  clear: () => void;
}

interface DrawScreenProps {
  game: PlayerGame<DrawPlayerView>;
  players: PublicPlayer[];
  connected: boolean;
  isLeader: boolean;
  actions: DrawActions;
  onEnd: () => void;
  onPlayAgain: () => void;
}

const FEEDBACK = {
  correct: '✓ You got it!',
  close: 'So close! One letter off.',
  wrong: 'Nope. Try again!',
} as const;

export function DrawScreen({
  game,
  players,
  connected,
  isLeader,
  actions,
  onEnd,
  onPlayAgain,
}: DrawScreenProps) {
  const { view, serverTime } = game.update;
  const msLeft = useCountdown(view.endsAt, serverTime, game.receivedAt);
  const artistName = players.find((p) => p.id === view.artistId)?.name ?? 'Someone';

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

  const header = (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>
        Turn {view.turn}/{view.totalTurns}
      </Text>
      {view.phase !== 'reveal' && <Text style={styles.timer}>{Math.ceil(msLeft / 1000)}s</Text>}
      {isLeader && <EndGameButton onEnd={onEnd} />}
    </View>
  );

  if (view.phase === 'reveal') {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centered}>
          <Text style={styles.muted}>The word was</Text>
          <Text style={styles.big}>{view.word}</Text>
          <Text style={styles.points}>+{view.gained}</Text>
          <Text style={styles.muted}>
            {view.isArtist
              ? view.gained > 0
                ? 'People guessed your drawing!'
                : 'Nobody guessed it this time.'
              : view.guessed
                ? 'Nice guess!'
                : 'Better luck next turn.'}
          </Text>
          <Text style={styles.muted}>
            {view.score} pts · #{view.rank} of {view.playerCount}
          </Text>
        </View>
      </View>
    );
  }

  if (view.phase === 'choosing') {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centered}>
          {view.isArtist ? (
            <>
              <Text style={styles.big}>Your turn to draw!</Text>
              <Text style={styles.muted}>Pick a word. Only you can see these.</Text>
              {view.wordChoices.map((word, index) => (
                <Pressable
                  key={word}
                  accessibilityRole="button"
                  accessibilityLabel={`Draw ${word}`}
                  disabled={!connected}
                  onPress={() => actions.choose(index)}
                  style={({ pressed }) => [styles.choice, pressed && styles.pressed]}
                >
                  <Text style={styles.wordText}>{word}</Text>
                </Pressable>
              ))}
            </>
          ) : (
            <>
              <Text style={styles.big}>{artistName} is choosing a word…</Text>
              <Text style={styles.muted}>Get ready to guess!</Text>
            </>
          )}
        </View>
      </View>
    );
  }

  if (view.isArtist) {
    const word = (
      <Text style={styles.word} accessibilityLabel={`Your word: ${view.word ?? ''}`}>
        {view.word}
      </Text>
    );
    // Drawing needs the phone sideways, for a bigger canvas
    return (
      <LandscapeOnly
        prompt={
          <View style={styles.container}>
            {header}
            <TurnPhonePrompt>
              <Text style={styles.muted}>Your word to draw:</Text>
              {word}
            </TurnPhonePrompt>
          </View>
        }
      >
        <ArtistPad
          key={view.turn}
          info={
            <>
              {header}
              <Text style={styles.muted}>Draw this (no letters!)</Text>
              {word}
            </>
          }
          actions={actions}
        />
      </LandscapeOnly>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      <Guessing view={view} artistName={artistName} connected={connected} onGuess={actions.guess} />
    </View>
  );
}

function ArtistPad({ info, actions }: { info: ReactNode; actions: DrawActions }) {
  const pad = useRef<DrawingPadHandle>(null);
  const [color, setColor] = useState(0);
  const [size, setSize] = useState(1);

  return (
    <DrawBoard
      canvas={<DrawingPad ref={pad} color={color} size={size} onStroke={actions.stroke} />}
    >
      {info}

      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Colours">
        {DRAW_COLORS.map((value, index) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityLabel={index === DRAW_COLORS.length - 1 ? 'Eraser' : `Colour ${index + 1}`}
            aria-checked={color === index}
            onPress={() => setColor(index)}
            style={[styles.swatch, { backgroundColor: value }, color === index && styles.selected]}
          >
            {index === DRAW_COLORS.length - 1 && <Text style={styles.eraser}>⌫</Text>}
          </Pressable>
        ))}
      </View>

      <View style={styles.row}>
        {DRAW_SIZES.map((value, index) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityLabel={['Thin', 'Medium', 'Thick'][index]}
            aria-checked={size === index}
            onPress={() => setSize(index)}
            style={[styles.tool, size === index && styles.selected]}
          >
            <View style={[styles.dot, { width: 6 + index * 8, height: 6 + index * 8 }]} />
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            pad.current?.undo();
            actions.undo();
          }}
          style={styles.tool}
        >
          <Text style={styles.toolText}>Undo</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            pad.current?.clear();
            actions.clear();
          }}
          style={styles.tool}
        >
          <Text style={styles.toolText}>Clear</Text>
        </Pressable>
      </View>
    </DrawBoard>
  );
}

function Guessing({
  view,
  artistName,
  connected,
  onGuess,
}: {
  view: DrawPlayerView;
  artistName: string;
  connected: boolean;
  onGuess: (text: string) => void;
}) {
  const [text, setText] = useState('');
  const submit = () => {
    if (!text.trim()) return;
    onGuess(text.trim());
    setText('');
  };

  return (
    <View style={styles.centered}>
      <Text style={styles.muted}>{artistName} is drawing. Look at the TV!</Text>
      <Text style={styles.hint} accessibilityLabel="Word to guess">
        {view.hint}
      </Text>

      {view.guessed ? (
        <Text style={[styles.big, styles.correct]}>{FEEDBACK.correct}</Text>
      ) : (
        <>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={submit}
            placeholder="Your guess"
            placeholderTextColor={colors.muted}
            maxLength={GUESS_MAX_LENGTH}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            submitBehavior="submit"
            editable={connected}
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!connected || !text.trim()}
            onPress={submit}
            style={({ pressed }) => [
              styles.guessButton,
              (!connected || !text.trim()) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.wordText}>Guess</Text>
          </Pressable>
          {view.lastGuess && view.lastGuess !== 'correct' && (
            <Text style={view.lastGuess === 'close' ? styles.close : styles.muted}>
              {FEEDBACK[view.lastGuess]}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 8,
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
  big: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  points: {
    color: '#46d39a',
    fontSize: 44,
    fontWeight: '800',
  },
  muted: {
    color: colors.muted,
    textAlign: 'center',
  },
  word: {
    color: colors.warning,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  choice: {
    alignSelf: 'stretch',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  wordText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  swatch: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    borderWidth: 2,
    borderColor: colors.border,
  },
  eraser: {
    color: '#1b1b1f',
    fontSize: 14,
  },
  selected: {
    borderColor: colors.accent,
    borderWidth: 3,
    transform: [{ scale: 1.1 }],
  },
  tool: {
    minWidth: 44,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  toolText: {
    color: colors.text,
    fontWeight: '600',
  },
  dot: {
    borderRadius: 999,
    backgroundColor: colors.text,
  },
  hint: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
  },
  input: {
    alignSelf: 'stretch',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 20,
  },
  guessButton: {
    alignSelf: 'stretch',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  correct: {
    color: '#46d39a',
  },
  close: {
    color: colors.warning,
    fontWeight: '700',
    textAlign: 'center',
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
