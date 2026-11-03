import {
  LIAR_MAX_PLAY,
  liarCardName,
  liarRank,
  type LiarCard,
  type LiarsPlayerView,
  type PublicPlayer,
} from '@couchwave/shared';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EndGameButton } from '../components/EndGameButton';
import { colors } from '../theme';
import { useCountdown } from '../useCountdown';
import type { PlayerGame } from '../useController';

export interface LiarsActions {
  play: (cardIds: number[]) => void;
  call: () => void;
}

interface LiarsScreenProps {
  game: PlayerGame<LiarsPlayerView>;
  players: PublicPlayer[];
  connected: boolean;
  isLeader: boolean;
  actions: LiarsActions;
  onEnd: () => void;
  onPlayAgain: () => void;
}

/** Liar's Table on the phone: your secret hand, then play or call. */
export function LiarsScreen({
  game,
  players,
  connected,
  isLeader,
  actions,
  onEnd,
  onPlayAgain,
}: LiarsScreenProps) {
  const { view, serverTime } = game.update;
  const msLeft = useCountdown(view.endsAt, serverTime, game.receivedAt);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'Player';
  const rank = liarRank(view.tableRank);

  if (view.phase === 'finished') {
    return (
      <View style={styles.centered}>
        <Text style={styles.eyebrow}>Game over</Text>
        <Text style={styles.big}>
          {view.rank === 1
            ? '🏆 You won!'
            : `${view.winnerId ? nameOf(view.winnerId) : 'Nobody'} wins`}
        </Text>
        <Text style={styles.muted}>
          {view.rank === 1 ? 'Last one standing.' : `You finished #${view.rank}`}
        </Text>
        {isLeader ? (
          <>
            <Pressable
              accessibilityRole="button"
              disabled={!connected}
              onPress={onPlayAgain}
              style={({ pressed }) => [styles.button, styles.endButton, pressed && styles.pressed]}
            >
              <Text style={styles.buttonText}>Play again</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={!connected} onPress={onEnd}>
              <Text style={styles.link}>Back to the games</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.muted}>Waiting for the host to pick the next game…</Text>
        )}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Hand {view.round}</Text>
        {view.phase === 'turn' && (
          <Text style={styles.timer} accessibilityLabel="Seconds left">
            {Math.ceil(msLeft / 1000)}s
          </Text>
        )}
        {isLeader && <EndGameButton onEnd={onEnd} />}
      </View>

      <View style={styles.status}>
        <Text style={styles.claim}>
          Table card: <Text style={styles.claimRank}>{rank.plural}</Text>
        </Text>
        <Text accessibilityLabel="Your lives">
          {view.alive ? '❤️'.repeat(view.lives) : '💀'}
          {view.alive && <Text style={styles.spent}>{'♡'.repeat(view.maxLives - view.lives)}</Text>}
        </Text>
      </View>

      {!view.alive ? (
        <View style={styles.body}>
          <Text style={styles.big}>💀 You're out</Text>
          <Text style={styles.muted}>Watch the TV and see who's lying.</Text>
          {view.reveal && <RevealNote view={view} nameOf={nameOf} />}
        </View>
      ) : view.phase === 'reveal' ? (
        <View style={styles.body}>
          <RevealNote view={view} nameOf={nameOf} />
          <Text style={styles.muted}>A new hand is coming. Look at the TV!</Text>
        </View>
      ) : (
        /* Keyed so nothing stays selected from your last turn */
        <Hand
          key={`${view.round}-${view.turnId}`}
          view={view}
          connected={connected}
          nameOf={nameOf}
          actions={actions}
        />
      )}
    </ScrollView>
  );
}

function RevealNote({ view, nameOf }: { view: LiarsPlayerView; nameOf: (id: string) => string }) {
  const reveal = view.reveal;
  if (!reveal) return null;
  return (
    <>
      <View style={styles.cards} aria-label="The cards">
        {reveal.cards.map((card) => (
          <CardFace key={card.id} card={card} />
        ))}
      </View>
      <Text style={styles.title}>
        {nameOf(reveal.playerId)} {reveal.lied ? 'was lying!' : 'told the truth!'}
      </Text>
      <Text style={styles.muted}>
        {reveal.loserId
          ? `${nameOf(reveal.loserId)} ${reveal.eliminated ? 'is out 💀' : 'loses a life 💔'}`
          : 'Nobody loses a life'}
      </Text>
    </>
  );
}

function Hand({
  view,
  connected,
  nameOf,
  actions,
}: {
  view: LiarsPlayerView;
  connected: boolean;
  nameOf: (id: string) => string;
  actions: LiarsActions;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const rank = liarRank(view.tableRank);
  const toggle = (id: number) =>
    setSelected((now) => {
      if (now.includes(id)) return now.filter((other) => other !== id);
      return now.length < LIAR_MAX_PLAY ? [...now, id] : now;
    });
  const count = selected.length;

  return (
    <View style={styles.body}>
      {view.isMyTurn ? (
        <Text style={styles.title}>
          {view.lastPlay
            ? `${nameOf(view.lastPlay.playerId)} says: ${view.lastPlay.count} ${
                view.lastPlay.count === 1 ? rank.name : rank.plural
              }`
            : 'You go first'}
        </Text>
      ) : (
        <Text style={styles.muted}>
          {view.phase === 'deal'
            ? `Look at your cards. ${view.turnId ? nameOf(view.turnId) : 'Someone'} goes first.`
            : `${view.turnId ? nameOf(view.turnId) : 'Someone'} is thinking…`}
        </Text>
      )}

      {view.isMyTurn && view.lastPlay && (
        <Pressable
          accessibilityRole="button"
          disabled={!connected}
          onPress={actions.call}
          style={({ pressed }) => [styles.button, styles.liar, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>🤥 Liar!</Text>
        </Pressable>
      )}

      {view.hand.length === 0 ? (
        <Text style={styles.safe}>
          No cards left: you're safe unless your last play gets called.
        </Text>
      ) : (
        <View style={styles.cards} accessibilityLabel="Your cards">
          {view.hand.map((card) => {
            const chosen = selected.includes(card.id);
            return (
              <Pressable
                key={card.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: chosen, disabled: !view.isMyTurn }}
                accessibilityLabel={liarCardName(card)}
                disabled={!view.isMyTurn || !connected}
                onPress={() => toggle(card.id)}
              >
                <CardFace card={card} chosen={chosen} />
              </Pressable>
            );
          })}
        </View>
      )}

      {view.isMyTurn && (
        <>
          <Text style={styles.muted}>
            {view.lastPlay ? 'Or pass it on: pick' : 'Pick'} 1 to {LIAR_MAX_PLAY} cards to play as{' '}
            {rank.plural}.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={count === 0 || !connected}
            onPress={() => actions.play(selected)}
            style={({ pressed }) => [
              styles.button,
              (count === 0 || !connected) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.buttonText}>
              {count === 0
                ? 'Play cards'
                : `Play ${count} as ${count === 1 ? rank.name : rank.plural}`}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function CardFace({ card, chosen = false }: { card: LiarCard; chosen?: boolean }) {
  return (
    <View style={[styles.card, chosen && styles.chosen]}>
      <Text style={[styles.cardRank, card.rank === 'joker' && styles.joker]}>
        {card.rank === 'joker' ? '🃏' : card.rank}
      </Text>
      <Text style={styles.cardName}>{liarCardName(card)}</Text>
    </View>
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
    padding: 24,
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
  status: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  claim: {
    color: colors.muted,
    fontSize: 16,
  },
  claimRank: {
    color: colors.warning,
    fontWeight: '800',
  },
  spent: {
    color: colors.muted,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  big: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
  },
  muted: {
    color: colors.muted,
    textAlign: 'center',
  },
  safe: {
    color: '#46d39a',
    fontWeight: '700',
    textAlign: 'center',
  },
  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  card: {
    width: 60,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#d9d3f5',
    backgroundColor: '#f4f1ff',
  },
  chosen: {
    borderColor: colors.accent,
    transform: [{ translateY: -8 }],
    boxShadow: `0 0 0 2px ${colors.accent}`,
  },
  cardRank: {
    color: '#1c1633',
    fontSize: 32,
    fontWeight: '800',
  },
  joker: {
    fontSize: 26,
  },
  cardName: {
    color: '#5b5478',
    fontSize: 11,
    fontWeight: '600',
  },
  button: {
    alignSelf: 'stretch',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  endButton: {
    alignSelf: 'center',
    marginTop: 16,
    paddingHorizontal: 32,
  },
  liar: {
    backgroundColor: colors.danger,
  },
  buttonText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  link: {
    color: colors.muted,
    fontWeight: '600',
    padding: 8,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
