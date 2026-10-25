import { Link } from 'react-router';

const STEPS = [
  {
    title: 'Open it on a big screen',
    text: 'A TV, a laptop, a projector. Press Create Game Room and you get a room code.',
  },
  {
    title: 'Scan with your phones',
    text: 'Everyone scans the QR code. No app, no sign-up. The first to join is the host.',
  },
  {
    title: 'Play',
    text: 'Questions on the TV, buttons on your phone. Fast answers win more points.',
  },
];

export function HomePage() {
  return (
    <>
      <section className="hero">
        <h1 className="hero-title">couchwave</h1>
        <p className="hero-tagline">
          a chaotic party games console where your phone is your joystick
        </p>
        <Link to="/room" className="primary-button">
          Create Game Room
        </Link>
      </section>

      <section className="steps" aria-labelledby="how-it-works">
        <h2 id="how-it-works">How it works</h2>
        <ol>
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <span className="step-number">{i + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
