const STACK = [
  { area: 'Real-time', tech: 'Socket.IO over WebSockets, with reconnection and server-run timers' },
  { area: 'API', tech: 'NestJS (TypeScript), self-hosted with Coolify on Oracle Cloud' },
  { area: 'TV screen', tech: 'React + Vite, deployed on Vercel' },
  { area: 'Phone controller', tech: 'React Native (Expo), running in the browser' },
  { area: 'Game logic', tech: 'Pure TypeScript state machines shared across the monorepo' },
  {
    area: 'Quality',
    tech: 'Vitest, Testing Library, end-to-end socket tests, GitHub Actions CI/CD',
  },
];

export function AboutPage() {
  return (
    <article className="prose">
      <h1>About</h1>
      <p>
        Couchwave turns any screen into a party game console. The big screen shows the game, and
        everyone plays from their phone. There's nothing to install: scan the QR code and you're in.
      </p>
      <p>
        It's a personal project built to learn full-stack and real-time development end to end, from
        WebSockets and game state machines to testing and automated deployments.
      </p>

      <h2>Under the hood</h2>
      <dl className="stack">
        {STACK.map(({ area, tech }) => (
          <div key={area}>
            <dt>{area}</dt>
            <dd>{tech}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
