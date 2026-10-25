const REPO = 'https://github.com/xPinhoo/couchwave';

// TODO(M4): replace with a contact form once the API has a database to store messages
export function ContactsPage() {
  return (
    <article className="prose">
      <h1>Contacts</h1>
      <p>Have an idea for a game, found a bug, or need help getting a room going?</p>

      <ul className="contact-options">
        <li>
          <h2>💡 Ideas & feature requests</h2>
          <p>Suggest a game or an improvement.</p>
          <a href={`${REPO}/issues/new?labels=idea`} target="_blank" rel="noreferrer">
            Open an idea on GitHub
          </a>
        </li>
        <li>
          <h2>🐞 Bugs & help</h2>
          <p>Tell us what happened and on which device.</p>
          <a href={`${REPO}/issues/new?labels=bug`} target="_blank" rel="noreferrer">
            Report a problem on GitHub
          </a>
        </li>
      </ul>
    </article>
  );
}
