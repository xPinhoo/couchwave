import { Link, NavLink, Outlet } from 'react-router';
import { Logo } from '../components/Logo';

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/contacts', label: 'Contacts' },
  { to: '/about', label: 'About' },
];

export function SiteLayout() {
  return (
    <div className="site">
      <header className="site-header">
        <Link to="/" className="brand" aria-label="Couchwave home">
          <Logo />
        </Link>
        <nav aria-label="Main">
          <ul>
            {NAV.map(({ to, label }) => (
              <li key={to}>
                <NavLink to={to} end>
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <span>Couchwave · a portfolio project</span>
        <a href="https://github.com/xPinhoo/couchwave" target="_blank" rel="noreferrer">
          Source on GitHub
        </a>
      </footer>
    </div>
  );
}
