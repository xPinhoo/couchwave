# Couchwave

Party games on the big screen, played with your phone as the controller.

The **host** runs on a TV or laptop and shows a room code and QR code. Friends join from the
**controller** app on their phones (native via Expo, or straight from the browser) and play
mini-games together in real time over WebSockets.

## Architecture

```
apps/
  api/          NestJS: REST + Socket.IO gateway, owns all game state
  host/         React + Vite: the big screen
  controller/   Expo (React Native): phone controller for iOS, Android and web
packages/
  shared/       zod schemas, constants and the typed socket event contract
  engine/       pure TypeScript room and game logic (no I/O)
```

- **The server owns the game state.** Phones only send inputs and the server decides the outcome,
  so players can't cheat by sending their own results.
- **One typed contract.** `ClientToServerEvents` / `ServerToClientEvents` in `packages/shared` are
  used by the API, the host and the controller, so a renamed event fails to compile everywhere.
- **Pure engine.** Room and game rules are plain functions that receive time and randomness as
  arguments, which makes them deterministic and quick to unit-test.
- **Seats survive dropped connections.** Joining returns a secret session token. If a phone
  sleeps or loses Wi-Fi, its player stays in the room marked as away for a grace period
  (30 s by default). The controller sends `room:rejoin` with the token whenever its socket
  reconnects and gets the same seat back. If a newer connection reclaims the seat, the old
  socket is kicked, and its late disconnect is ignored.

## Getting started

Requires Node 24+.

```bash
npm install
npm run dev
```

| App        | URL                   |
| ---------- | --------------------- |
| API        | http://localhost:3000 |
| Host       | http://localhost:5173 |
| Controller | http://localhost:8081 |

To play from a real phone, open the host using your computer's LAN IP (e.g.
`http://192.168.1.20:5173`) instead of `localhost` and scan the QR code. For the native app,
scan the Expo QR code printed by `npm run dev` with Expo Go.

### Environment variables

| Variable              | App        | Default                              |
| --------------------- | ---------- | ------------------------------------ |
| `PORT`                | api        | `3000`                               |
| `CORS_ORIGINS`        | api        | any origin (comma-separated list)    |
| `RECONNECT_GRACE_MS`  | api        | `30000`                              |
| `VITE_API_URL`        | host       | same hostname as the page, port 3000 |
| `VITE_CONTROLLER_URL` | host       | same hostname as the page, port 8081 |
| `EXPO_PUBLIC_API_URL` | controller | the dev machine's address, port 3000 |

## Scripts

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Run every app in watch mode                   |
| `npm run build`     | Build all packages and apps                   |
| `npm run test`      | Unit and component tests (Vitest)             |
| `npm run test:e2e`  | API end-to-end tests with real socket clients |
| `npm run typecheck` | TypeScript across the monorepo                |
| `npm run lint`      | oxlint                                        |
| `npm run format`    | Prettier                                      |

## Roadmap

- [x] **M0** Monorepo, CI, create/join rooms with a live lobby
- [x] **M1a** Reconnection with a grace period
- [ ] **M1b** Deploy API + web apps
- [ ] **M2** First mini-game: quick-fire trivia
- [ ] **M3** Native controller polish: QR scanning, haptics
- [ ] **M4** Bluff and draw-and-guess games
- [ ] **M5** Accounts, custom question packs, game history
- [ ] **M6** Redis-backed rooms, load testing, observability
