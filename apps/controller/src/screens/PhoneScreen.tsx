import { PHRASE_MAX_LENGTH, type PhonePlayerView, type SketchOp } from '@couchwave/shared';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LandscapeOnly, TurnPhonePrompt } from '../components/DrawBoard';
import { EndGameButton } from '../components/EndGameButton';
import { SketchPad, SketchView } from '../components/Sketch';
import { colors } from '../theme';
import { useCountdown } from '../useCountdown';
import type { PlayerGame } from '../useController';

export interface PhoneActions {
  text: (text: string) => void;
  /** Resolves with a random phrase, or null if the server said no. */
  random: () => Promise<string | null>;
  op: (op: SketchOp) => void;
  undo: () => void;
  redo: () => void;
  done: (done: boolean) => void;
}

interface PhoneScreenProps {
  game: PlayerGame<PhonePlayerView>;
  connected: boolean;
  isLeader: boolean;
  actions: PhoneActions;
  onNext: () => void;
  onEnd: () => void;
  onPlayAgain: () => void;
}

const TASKS = {
  write: 'Write a secret phrase',
  draw: 'Draw this',
  guess: 'What is this drawing?',
} as const;

/** Drawing Phone on the phone: write, draw or guess, then watch the reveal on the TV. */
export function PhoneScreen({
  game,
  connected,
  isLeader,
  actions,
  onNext,
  onEnd,
  onPlayAgain,
}: PhoneScreenProps) {
  const { view, serverTime } = game.update;
  const msLeft = useCountdown(view.endsAt, serverTime, game.receivedAt);

  if (view.phase === 'finished') {
    return (
      <View style={styles.centered}>
        <Text style={styles.eyebrow}>Game over</Text>
        <Text style={styles.big}>📞 That's a wrap!</Text>
        {isLeader ? (
          <>
            <BigButton label="Play again" disabled={!connected} onPress={onPlayAgain} />
            <Pressable accessibilityRole="button" disabled={!connected} onPress={onEnd}>
              <Text style={styles.linkText}>Back to the games</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.muted}>Waiting for the host to pick the next game…</Text>
        )}
      </View>
    );
  }

  if (view.phase === 'reveal') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>The reveal</Text>
          {isLeader && <EndGameButton onEnd={onEnd} />}
        </View>
        <View style={styles.centered}>
          <Text style={styles.big}>👀 Look at the TV!</Text>
          <Text style={styles.muted}>See what became of everyone's phrase.</Text>
          {isLeader && <BigButton label="Next ▶" disabled={!connected} onPress={onNext} />}
        </View>
      </View>
    );
  }

  const header = (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>
        Step {view.step}/{view.totalSteps}
      </Text>
      <Text style={styles.timer} accessibilityLabel="Seconds left">
        {Math.ceil(msLeft / 1000)}s
      </Text>
      {isLeader && <EndGameButton onEnd={onEnd} />}
    </View>
  );

  if (view.phase === 'draw' && !view.done) {
    return (
      <DrawStep
        key={view.step}
        view={view}
        header={header}
        connected={connected}
        actions={actions}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {header}
      {/* A fresh step starts with a fresh text box */}
      <Step key={view.step} view={view} connected={connected} actions={actions} />
    </ScrollView>
  );
}

/** Drawing, with the phone sideways for a bigger canvas. */
function DrawStep({
  view,
  header,
  connected,
  actions,
}: {
  view: PhonePlayerView;
  header: ReactNode;
  connected: boolean;
  actions: PhoneActions;
}) {
  const phrase = (
    <Text style={styles.phrase} accessibilityLabel={`Your phrase: ${view.phrase ?? ''}`}>
      {view.phrase}
    </Text>
  );

  return (
    <LandscapeOnly
      prompt={
        <View style={styles.container}>
          {header}
          <TurnPhonePrompt>
            <Text style={styles.muted}>Your phrase to draw:</Text>
            {phrase}
          </TurnPhonePrompt>
        </View>
      }
    >
      <SketchPad
        initial={view.sketch}
        disabled={!connected}
        onOp={actions.op}
        onUndo={actions.undo}
        onRedo={actions.redo}
        info={
          <>
            {header}
            {phrase}
          </>
        }
        footer={<BigButton label="Done" disabled={!connected} onPress={() => actions.done(true)} />}
      />
    </LandscapeOnly>
  );
}

function Step({
  view,
  connected,
  actions,
}: {
  view: PhonePlayerView;
  connected: boolean;
  actions: PhoneActions;
}) {
  const [text, setText] = useState(view.draft);
  const task = view.phase === 'write' || view.phase === 'draw' ? view.phase : 'guess';
  const typing = task !== 'draw';
  const locked = view.done || !connected;

  const change = (next: string) => {
    setText(next);
    actions.text(next);
  };
  const random = async () => {
    const phrase = await actions.random();
    if (phrase !== null) setText(phrase);
  };

  return (
    <View style={styles.step}>
      <Text style={styles.title}>{TASKS[task]}</Text>

      {task === 'write' && (
        <Text style={styles.muted}>Something fun to draw. Nobody sees it until the end.</Text>
      )}
      {task === 'draw' && (
        <Text style={styles.phrase} accessibilityLabel={`Your phrase: ${view.phrase ?? ''}`}>
          {view.phrase}
        </Text>
      )}
      {task === 'guess' && <SketchView ops={view.drawing ?? []} />}

      {typing && (
        <TextInput
          value={text}
          onChangeText={change}
          placeholder={task === 'write' ? 'An elephant wearing a hat' : 'Your guess'}
          placeholderTextColor={colors.muted}
          maxLength={PHRASE_MAX_LENGTH}
          editable={!locked}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          onSubmitEditing={() => text.trim() && actions.done(true)}
          style={[styles.input, locked && styles.disabled]}
        />
      )}
      {task === 'write' && !view.done && (
        <Pressable
          accessibilityRole="button"
          disabled={!connected}
          onPress={() => void random()}
          style={styles.link}
        >
          <Text style={styles.linkText}>🎲 Give me a random one</Text>
        </Pressable>
      )}

      {view.done ? (
        <>
          <Text style={styles.done}>
            ✓ Done! Waiting for the others ({view.doneCount}/{view.playerCount})
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={!connected}
            onPress={() => actions.done(false)}
            style={styles.link}
          >
            <Text style={styles.linkText}>✎ Edit</Text>
          </Pressable>
        </>
      ) : (
        <BigButton
          label="Done"
          disabled={!connected || (typing && !text.trim())}
          onPress={() => actions.done(true)}
        />
      )}
    </View>
  );
}

function BigButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    gap: 12,
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
  step: {
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  big: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  phrase: {
    color: colors.warning,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  muted: {
    color: colors.muted,
    textAlign: 'center',
  },
  input: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 20,
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
  done: {
    color: '#46d39a',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  link: {
    alignSelf: 'center',
    padding: 8,
  },
  linkText: {
    color: colors.muted,
    fontWeight: '600',
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
