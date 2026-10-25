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
- **Games are pure state machines.** Each mini-game implements `GameModule` in
  `packages/engine`: `init`, `onInput`, `onTick`, plus a `hostView` for the TV and a private
  `playerView` per phone. The API runs a 250 ms loop per active room and broadcasts only when
  the state changes.
- **Countdowns line up across devices.** Every game update carries the server's clock, and
  clients correct for their own clock being ahead or behind.

## Games

**Quick-fire trivia** has 8 questions. The question is shown on the TV, and each phone shows
four coloured answer buttons. A correct answer scores 500 points, plus up to 500 more for
speed. The reveal happens as soon as everyone has answered, or when the 15 s timer runs out.

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

## Deployment

| App        | Where  | URL                                     |
| ---------- | ------ | --------------------------------------- |
| API        | Fly.io | https://couchwave-api.fly.dev           |
| Host       | Vercel | https://couchwave-host.vercel.app       |
| Controller | Vercel | https://couchwave-controller.vercel.app |

Every push to `main` runs the [CI/CD workflow](.github/workflows/ci.yml):

1. **verify**: lint, format check, typecheck, unit tests, API e2e tests, build
2. **docker**: builds the API image from [`apps/api/Dockerfile`](apps/api/Dockerfile)
3. **deploy-api**: `flyctl deploy`, then a smoke test against `/health`
4. **deploy-web**: builds the host and controller on the runner and uploads the output to
   Vercel. This runs after the API so the web apps never talk to an older API.

Pull requests run steps 1 and 2 only. Deploy jobs are skipped (not failed) while their
credentials are missing.

The API runs on **a single machine** on purpose: rooms live in memory, so two machines would
each have their own rooms. Running more than one instance needs Redis (M6). The machine stops
when idle and starts again on the next request. Deploys restart it, which ends any games in
progress.

### One-time setup

**Fly.io**

1. Install flyctl and sign in: `fly auth login`
2. Create the app: `fly apps create couchwave-api`
3. Create a deploy token: `fly tokens create deploy -a couchwave-api`

**Vercel**

1. Sign in at vercel.com with GitHub and create two projects from this repository:
   `couchwave-host` with Root Directory `apps/host`, and `couchwave-controller` with Root
   Directory `apps/controller`. Vercel's own Git deploys are switched off in each `vercel.json`,
   so only CI deploys.
2. Create a token under Account Settings → Tokens.
3. Copy the Team ID (Team Settings → General) and each Project ID (Project Settings → General).

**GitHub** → Settings → Secrets and variables → Actions → New repository secret:

| Secret                         | Value                         |
| ------------------------------ | ----------------------------- |
| `FLY_API_TOKEN`                | the Fly deploy token          |
| `VERCEL_TOKEN`                 | the Vercel token              |
| `VERCEL_ORG_ID`                | the Vercel Team ID            |
| `VERCEL_HOST_PROJECT_ID`       | the `couchwave-host` ID       |
| `VERCEL_CONTROLLER_PROJECT_ID` | the `couchwave-controller` ID |

If a name is already taken (the Fly app or a `*.vercel.app` domain), update the URLs in
`fly.toml` (`app` and `CORS_ORIGINS`), `.github/workflows/ci.yml`, and both
`.env.production` files.

## Roadmap

- [x] **M0** Monorepo, CI, create/join rooms with a live lobby
- [x] **M1a** Reconnection with a grace period
- [x] **M1b** Deploy API + web apps
- [x] **M2** First mini-game: quick-fire trivia
- [ ] **M3** Native controller polish: QR scanning, haptics
- [ ] **M4** Bluff and draw-and-guess games
- [ ] **M5** Accounts, custom question packs, game history
- [ ] **M6** Redis-backed rooms, load testing, observability
