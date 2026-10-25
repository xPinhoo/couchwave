import type { RouteObject } from 'react-router';
import { SiteLayout } from './layouts/SiteLayout';
import { AboutPage } from './pages/AboutPage';
import { ContactsPage } from './pages/ContactsPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RoomPage } from './pages/RoomPage';

export const routes: RouteObject[] = [
  {
    // Regular website pages share the header and footer
    element: <SiteLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'contacts', element: <ContactsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  // The TV screen is full-screen, without site navigation
  { path: 'room', element: <RoomPage /> },
];
