import {
  LIAR_HAND_SIZE,
  liarRank,
  type LiarCard,
  type LiarRank,
  type LiarReveal,
  type LiarsHostView,
  type LobbyState,
} from '@couchwave/shared';
import type { HostGame } from '../useHostRoom';
import { useCountdownTicks } from '../sound';
import { useCountdown } from '../useCountdown';
import { FinalScores } from './FinalScores';
import { PlayerAvatar } from './PlayerAvatar';
import type { PlayerLookup } from './PlayerTag';

const hearts = (lives: number) => '❤️'.repeat(lives);
const cards = (count: number) => `${count} ${count === 1 ? 'card' : 'cards'}`;

/** Liar's Table on the TV: the table card and face-down cards, and never anyone's hand. */
export function LiarsHost({ game, lobby }: { game: HostGame<LiarsHostView>; lobby: LobbyState }) {
  const { view, serverTime } = game.update;
  const msLeft = useCountdown(view.endsAt, serverTime, game.receivedAt);
  useCountdownTicks(msLeft, view.phase === 'turn');
  const playerOf: PlayerLookup = (id) => lobby.players.find((p) => p.id === id);
  const nameOf = (id: string) => playerOf(id)?.name ?? 'Player';

  if (view.phase === 'finished') {
    return (
      <FinalScores
        leaderboard={view.leaderboard}
        players={lobby.players}
        leaderId={lobby.leaderId}
        title={view.winnerId ? `🏆 ${nameOf(view.winnerId)} is the last one standing` : undefined}
        formatScore={(lives) => (lives > 0 ? hearts(lives) : 'Out')}
      />
    );
  }

  const rank = liarRank(view.tableRank);
  return (
    <main className="trivia liars">
      <header className="trivia-header">
        <span className="eyebrow">🤥 Liar's Table · Hand {view.round}</span>
        {view.phase === 'turn' && (
          <span className="timer" aria-label="Seconds left">
            {Math.ceil(msLeft / 1000)}
          </span>
        )}
        <span className="eyebrow">Room {lobby.roomCode}</span>
      </header>

      {/* Keyed so each phase of each hand fades in */}
      <section className="liars-stage" key={`${view.phase}-${view.round}`}>
        <div className="liars-table-card" aria-label="Table card">
          <span className="liar-card face" data-rank={view.tableRank}>
            {view.tableRank}
          </span>
          <span className="hint">Everyone is playing {rank.plural}</span>
        </div>

        <div className="liars-middle">
          {view.phase === 'reveal' && view.reveal ? (
            <Reveal reveal={view.reveal} nameOf={nameOf} tableRank={view.tableRank} />
          ) : view.phase === 'deal' ? (
            <>
              <h1>This hand: {rank.plural}!</h1>
              <p className="hint">
                {cards(LIAR_HAND_SIZE)} each. Check your phone, and keep a straight face.
              </p>
            </>
          ) : view.lastPlay ? (
            <>
              <ul className="liar-cards" aria-label="Cards on the table">
                {Array.from({ length: view.lastPlay.count }, (_, i) => (
                  <li key={i}>
                    <span className="liar-card back" />
                  </li>
                ))}
              </ul>
              <h1>
                {nameOf(view.lastPlay.playerId)} says: {view.lastPlay.count}{' '}
                {view.lastPlay.count === 1 ? rank.name : rank.plural}
              </h1>
              {view.turnId && (
                <p className="hint">
                  {nameOf(view.turnId)}: let it pass, or call "Liar!"? · {cards(view.pileCount)} on
                  the table
                </p>
              )}
            </>
          ) : (
            <>
              <h1>{view.turnId ? `${nameOf(view.turnId)} goes first` : ''}</h1>
              <p className="hint">Play one to three cards. Honestly, or not.</p>
            </>
          )}
        </div>
      </section>

      <footer className="trivia-footer">
        <ul className="liars-seats" aria-label="Players">
          {view.playerIds.map((id) => {
            const player = playerOf(id);
            const out = !view.aliveIds.includes(id);
            const classes = [id === view.turnId && 'turn', out && 'out'].filter(Boolean).join(' ');
            return (
              <li key={id} className={classes || undefined}>
                {player && <PlayerAvatar avatar={player.avatar} size={56} />}
                <span className="liars-seat-name">{player?.name ?? 'Player'}</span>
                <span aria-label="Lives">{out ? '💀' : hearts(view.lives[id] ?? 0)}</span>
                {!out && (
                  <span className="hint" aria-label="Cards left">
                    {cards(view.handCounts[id] ?? 0)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </footer>
    </main>
  );
}

function FaceUp({ card, honest }: { card: LiarCard; honest: boolean }) {
  return (
    <span className={`liar-card face flip ${honest ? 'honest' : 'wrong'}`} data-rank={card.rank}>
      {card.rank === 'joker' ? '🃏' : card.rank}
    </span>
  );
}

function Reveal({
  reveal,
  nameOf,
  tableRank,
}: {
  reveal: LiarReveal;
  nameOf: (id: string) => string;
  tableRank: LiarRank;
}) {
  const player = nameOf(reveal.playerId);
  const headline = reveal.callerId
    ? `${nameOf(reveal.callerId)} called ${player} a liar!`
    : `No one left to answer ${player}: the cards flip`;
  const honest = (card: LiarCard) => card.rank === 'joker' || card.rank === tableRank;
  return (
    <>
      <p className="liars-headline">{headline}</p>
      <ul className="liar-cards" aria-label="The cards">
        {reveal.cards.map((card) => (
          <li key={card.id}>
            <FaceUp card={card} honest={honest(card)} />
          </li>
        ))}
      </ul>
      <h1 className={reveal.lied ? 'liars-lied' : 'liars-truth'}>
        {reveal.lied ? `${player} was lying!` : `${player} told the truth!`}
      </h1>
      <p className="hint">
        {reveal.loserId
          ? reveal.eliminated
            ? `${nameOf(reveal.loserId)} lost their last life and is out 💀`
            : `${nameOf(reveal.loserId)} loses a life 💔`
          : 'Nobody loses a life'}
      </p>
    </>
  );
}
