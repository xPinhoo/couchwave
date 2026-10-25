import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <article className="prose">
      <h1>Page not found</h1>
      <p>
        That page doesn't exist. <Link to="/">Go back home</Link>.
      </p>
    </article>
  );
}
