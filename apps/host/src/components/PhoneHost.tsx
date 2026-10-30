import type { LobbyState, PhoneHostView, PhoneReveal } from '@couchwave/shared';
import type { HostGame } from '../useHostRoom';
import { useCountdownTicks } from '../sound';
import { useCountdown } from '../useCountdown';
import { PlayerAvatar } from './PlayerAvatar';
import { PlayerTag, type PlayerLookup } from './PlayerTag';
import { SketchCanvas } from './SketchCanvas';

const TASKS = {
  write: {
    emoji: '✍️',
    title: 'Write a secret phrase',
    hint: 'Something fun for the next person to draw.',
  },
  draw: { emoji: '🎨', title: 'Draw the phrase you got', hint: 'No letters or numbers!' },
  guess: { emoji: '🤔', title: 'Guess the drawing you got', hint: 'What on earth is it?' },
} as const;

/** Drawing Phone on the TV: who's done while everyone works, then the reveal, link by link. */
export function PhoneHost({ game, lobby }: { game: HostGame<PhoneHostView>; lobby: LobbyState }) {
  const { view, serverTime } = game.update;
  const msLeft = useCountdown(view.endsAt, serverTime, game.receivedAt);
  useCountdownTicks(msLeft, view.phase !== 'reveal' && view.phase !== 'finished');
  const playerOf: PlayerLookup = (id) => lobby.players.find((p) => p.id === id);

  if (view.phase === 'finished') {
    return (
      <main className="phone">
        <header className="setup-header">
          <p className="eyebrow">Room {lobby.roomCode}</p>
          <h1>📞 That's a wrap!</h1>
        </header>
        <ol className="phone-summaries" aria-label="Every phrase">
          {view.summaries.map((summary) => (
            <li key={summary.ownerId}>
              <PlayerTag player={playerOf(summary.ownerId)} size={40} />
              <span className="phone-quote">“{summary.original}”</span>
              <span aria-hidden="true">→</span>
              <span className="phone-quote ending">“{summary.final}”</span>
            </li>
          ))}
        </ol>
        <p className="hint">The host can play again from their phone.</p>
      </main>
    );
  }

  if (view.phase === 'reveal' && view.reveal) {
    const { reveal } = view;
    const owner = playerOf(reveal.ownerId);
    return (
      <main className="phone">
        <header className="trivia-header">
          <span className="eyebrow">
            📞 {owner?.name ?? 'Someone'}'s phrase · {reveal.chain + 1}/{reveal.totalChains}
          </span>
          <ol className="phone-progress" aria-label="Progress">
            {Array.from({ length: reveal.entryCount + 1 }, (_, i) => (
              <li key={i} className={i <= reveal.entry ? 'seen' : undefined} />
            ))}
          </ol>
          <span className="eyebrow">Room {lobby.roomCode}</span>
        </header>
        {/* Keyed so each link fades in */}
        <section className="phone-reveal" key={`${reveal.chain}-${reveal.entry}`}>
          <RevealCard reveal={reveal} playerOf={playerOf} />
        </section>
      </main>
    );
  }

  const task = TASKS[view.phase === 'reveal' ? 'guess' : view.phase];
  return (
    <main className="phone">
      <header className="trivia-header">
        <span className="eyebrow">
          📞 Drawing Phone · Step {view.step}/{view.totalSteps}
        </span>
        <span className="timer" aria-label="Seconds left">
          {Math.ceil(msLeft / 1000)}
        </span>
        <span className="eyebrow">Room {lobby.roomCode}</span>
      </header>

      <section className="phone-task">
        <span className="phone-task-emoji" aria-hidden="true">
          {task.emoji}
        </span>
        <h1>{task.title}</h1>
        <p className="hint">{task.hint} Use your phone.</p>
      </section>

      <footer className="trivia-footer">
        <ul className="answered-row" aria-label="Who is done">
          {view.playerIds.map((id) => {
            const player = playerOf(id);
            const done = view.doneIds.includes(id);
            return (
              <li key={id} className={done ? 'answered' : undefined}>
                <span className="avatar-badge">
                  {player && <PlayerAvatar avatar={player.avatar} size={64} />}
                  {done && (
                    <span className="check" aria-label="Done">
                      ✓
                    </span>
                  )}
                </span>
                <span>{player?.name ?? 'Player'}</span>
              </li>
            );
          })}
        </ul>
        <span className="hint">
          {view.doneIds.length}/{view.playerIds.length} done
        </span>
      </footer>
    </main>
  );
}

function RevealCard({ reveal, playerOf }: { reveal: PhoneReveal; playerOf: PlayerLookup }) {
  const { current, summary } = reveal;

  if (!current) {
    const unchanged = summary.original.trim().toLowerCase() === summary.final.trim().toLowerCase();
    return (
      <div className="phone-summary">
        <p className="eyebrow">Original</p>
        <p className="phone-quote">“{summary.original}”</p>
        <p className="eyebrow">Final</p>
        <p className="phone-quote ending">“{summary.final}”</p>
        <p className="hint">{unchanged ? '🎉 It made it all the way!' : '😂 Not quite…'}</p>
      </div>
    );
  }

  const who = <PlayerTag player={playerOf(current.playerId)} size={56} />;

  if (current.kind === 'sketch') {
    return (
      <div className="phone-drawing">
        <p className="phone-says">
          {who} got <strong>“{reveal.previousText ?? '…'}”</strong> and drew this:
        </p>
        <SketchCanvas ops={current.ops} />
      </div>
    );
  }

  const isFirst = reveal.entry === 0;
  return (
    <div className="phone-text">
      <p className="phone-says">
        {who}{' '}
        {isFirst
          ? current.source === 'random'
            ? 'got a random phrase:'
            : 'wrote:'
          : current.source === 'missed'
            ? 'ran out of time 🤷'
            : 'guessed:'}
      </p>
      {current.text && <p className="phone-quote">“{current.text}”</p>}
    </div>
  );
}
