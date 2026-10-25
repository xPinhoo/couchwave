import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { routes } from './routes';

const renderAt = (path: string) =>
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);

describe('website', () => {
  it('home page shows the pitch and links to a new game room', () => {
    renderAt('/');

    expect(screen.getByRole('heading', { level: 1, name: 'couchwave' })).toBeInTheDocument();
    expect(
      screen.getByText('a chaotic party games console where your phone is your joystick'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create Game Room' })).toHaveAttribute('href', '/room');
  });

  it('navigates between pages from the header', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });

    fireEvent.click(nav.querySelector('a[href="/about"]')!);
    expect(screen.getByRole('heading', { level: 1, name: 'About' })).toBeInTheDocument();

    fireEvent.click(nav.querySelector('a[href="/contacts"]')!);
    expect(screen.getByRole('heading', { level: 1, name: 'Contacts' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Couchwave home' }));
    expect(screen.getByRole('heading', { level: 1, name: 'couchwave' })).toBeInTheDocument();
  });

  it('shows a not-found page for unknown URLs', () => {
    renderAt('/nope');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
