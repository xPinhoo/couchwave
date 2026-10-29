# Couchwave

Party games on the big screen, played with your phone as the controller.

The **host** app is the website: a home page, and a full-screen TV view (`/room`) that shows a
room code and QR code. Friends join from the **controller** app on their phones (native via
Expo, or straight from the browser) and play mini-games together in real time over WebSockets.

The TV only displays. The **first player to join becomes the room's host 👑** (called the
_leader_ in the code, since "host" already names the TV app): they open the games library, browse
it with their phone as a joystick (◀ ▶ + Play), end games and kick players. If they leave for
good, the next player in join order takes over.

Players pick a name and an avatar when they join: one of 16 presets, or a selfie that the phone
crops and shrinks to a 160 px JPEG of a few KB before sending. While they wait, everyone can send
emoji reactions that float up the TV.

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
- **The TV can refresh too.** Creating a room returns a screen token, kept in the tab's
  `sessionStorage`. A refreshed TV sends `room:resume` and gets the same room back, mid-game
  included; phones show a banner while it's away. If the TV stays away for 2 minutes the room
  closes and everyone is told why, so abandoned rooms clean themselves up.

## Games

**Quick-fire trivia**

- **Setup:** the host picks a topic (General, Music, Sports, Cinema, Geography, History),
  10/15/30 seconds per question and 10/20/30 questions; the TV updates live. Confirming counts
  as the host's Ready, and everyone else taps a Ready button. The game starts as soon as every
  connected player is ready. The last settings are remembered for the next round.
- **Play:** the question is on the TV and each phone shows four coloured answer buttons. The TV
  ticks off each player's avatar as they answer, and the reveal starts as soon as everyone has
  answered or the timer runs out. Each player's avatar then appears on the answer they picked.
- **Scoring:** speed is a gamble. A correct answer scores 500 plus up to 500 for speed; a wrong
  one costs 100 plus up to 300 more the faster it came in; no answer costs 100. Scores can go
  negative.
- **End:** a podium for the top 3 and a list for everyone else. The host can play again with the
  same settings or go back to the games.
- **Questions:** 32 hand-written questions per topic, shuffled per game (answers too).

**Draw & Guess** (2+ players)

- **Setup:** 45/60/90 seconds to draw and 1–3 rounds; everyone draws once per round.
- **Turn:** the artist picks one of 3 words (only their phone shows them), then draws it with a
  finger. Each stroke streams live to the TV: the phone sends points in small batches every
  50ms, as integers relative to a 4:3 canvas, so the drawing looks the same at any size. The
  artist has 8 colours (white is the eraser), 3 pen sizes, undo and clear.
- **Guessing:** everyone else types guesses on their phone. Wrong guesses show on the TV; a
  guess one letter off privately says "so close" (on the TV it would give the word away).
  Case, accents and extra spaces don't matter. Letters of the word appear as hints at 50% and
  75% of the time. The turn ends early once everyone has guessed.
- **Scoring:** a correct guess scores 200 plus up to 600 for speed; the artist scores 200 for
  each player who guessed. Nobody loses points.
- **Server side:** the game logic is a pure state machine like trivia, while the strokes go
  through the server without touching it: the server checks that they come from the artist,
  caps their size, forwards them to the TV only and keeps a copy for a TV that refreshes.
- **Words:** about 160 drawable words, never repeated within a game.

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

| Variable               | App        | Default                              |
| ---------------------- | ---------- | ------------------------------------ |
| `PORT`                 | api        | `3000`                               |
| `CORS_ORIGINS`         | api        | any origin (comma-separated list)    |
| `RECONNECT_GRACE_MS`   | api        | `30000`                              |
| `SCREEN_GRACE_MS`      | api        | `120000`                             |
| `GAME_MS_PER_SECOND`   | api        | `1000` (lower it to speed up timers) |
| `GAME_REVEAL_MS`       | api        | `5000`                               |
| `TRIVIA_MAX_QUESTIONS` | api        | no limit                             |
| `VITE_API_URL`         | host       | same hostname as the page, port 3000 |
| `VITE_CONTROLLER_URL`  | host       | same hostname as the page, port 8081 |
| `EXPO_PUBLIC_API_URL`  | controller | the dev machine's address, port 3000 |

## Scripts

| Command                | What it does                                                                |
| ---------------------- | --------------------------------------------------------------------------- |
| `npm run dev`          | Run every app in watch mode                                                 |
| `npm run build`        | Build all packages and apps                                                 |
| `npm run test`         | Unit and component tests (Vitest)                                           |
| `npm run test:e2e`     | API end-to-end tests with real socket clients                               |
| `npm run test:browser` | Playwright: a TV and phones playing a real game (run `npm run build` first) |
| `npm run typecheck`    | TypeScript across the monorepo                                              |
| `npm run lint`         | oxlint                                                                      |
| `npm run format`       | Prettier                                                                    |

## Deployment

| App        | Where                             | URL                                     |
| ---------- | --------------------------------- | --------------------------------------- |
| API        | Render (free plan), Coolify later | the `API_URL` repository variable       |
| Host       | Vercel                            | https://couchwave-host.vercel.app       |
| Controller | Vercel                            | https://couchwave-controller.vercel.app |

Every push to `main` runs the [CI/CD workflow](.github/workflows/ci.yml):

1. **verify**: lint, format check, typecheck, unit tests, API e2e tests, build
2. **browser-tests**: Playwright opens a TV and two phones in Chromium against the built apps
   and plays a full game of trivia and of Draw & Guess. On failure the report and traces are uploaded as an
   artifact (open a trace with `npx playwright show-trace`).
3. **docker**: builds the API image from [`apps/api/Dockerfile`](apps/api/Dockerfile) on an
   ARM runner, the same architecture as the server
4. **deploy-api**: on **Render**, calls the deploy hook for this commit and waits until
   `/health` reports it (`/health` returns the running commit). On **Coolify**, asks Coolify's
   API to deploy, waits until the deploy finishes, then smoke-tests `/health`. Either way the
   image is built from [`apps/api/Dockerfile`](apps/api/Dockerfile) and traffic only switches
   once the health check passes.
5. **deploy-web**: writes `API_URL` into each app's `.env.production.local`, builds the host
   and controller on the runner and uploads the output to Vercel. This runs after the API so
   the web apps never talk to an older API.

Pull requests run steps 1 to 3 only. Deploy jobs are skipped (not failed) while their settings
are missing.

The API runs as **a single container** on purpose: rooms live in memory, so two instances
would each have their own rooms. Running more than one needs Redis (M7). Deploys restart it,
which ends any games in progress.

### One-time setup

The API runs on **Render** for now ([`render.yaml`](render.yaml)). The free plan sleeps after
15 idle minutes and takes up to a minute to wake: the home page pings `/health` to start it
early, and the TV shows "Waking up the server…" meanwhile. The plan is to move it to
**Coolify on an Oracle Cloud** Always Free ARM server once one is available; CI supports both.

**Render**

1. Sign in at render.com with GitHub, then New → **Blueprint** → this repository. It reads
   `render.yaml`: a free Docker web service in Frankfurt, health check `/health`, auto-deploy
   off and `CORS_ORIGINS` set to the two Vercel apps.
2. Once it's live, copy its URL (e.g. `https://couchwave-api.onrender.com`) for `API_URL`.
3. Service → Settings → **Deploy Hook**: copy the URL into the `RENDER_DEPLOY_HOOK_URL` secret.

**Oracle Cloud server** (for Coolify)

1. Create an Always Free **VM.Standard.A1.Flex** (ARM) instance with **Ubuntu 24.04** and your
   SSH key. 1–2 OCPUs and 6–12 GB of RAM is plenty.
2. In the instance's VCN → Security List, allow inbound TCP **80**, **443** and **8000**
   (8000 only until Coolify has its own domain).
3. Oracle's Ubuntu images also block ports in the server's own firewall. Open them there too:

   ```bash
   for port in 80 443 8000; do
     sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport "$port" -j ACCEPT
   done
   sudo netfilter-persistent save
   ```

4. Install Coolify: `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash`, then
   open `http://<server-ip>:8000` and create the admin account straight away.

**Domain**: point an `A` record for the API (e.g. `api.example.com`) at the server's IP.

**Coolify app**

1. New resource → Public/GitHub repository → this repo, branch `main`, build pack
   **Dockerfile**, base directory `/`, Dockerfile location `/apps/api/Dockerfile`, port `3000`.
2. Domain: `https://api.example.com` (Coolify gets the Let's Encrypt certificate).
3. Environment variables:
   `CORS_ORIGINS=https://couchwave-host.vercel.app,https://couchwave-controller.vercel.app`
4. Health check: path `/health` (the image also has a Docker `HEALTHCHECK`).
5. Turn **off** automatic deploys on push: CI triggers deploys after the tests pass.
6. Settings → enable the API, then Keys & Tokens → create an API token with deploy permission.
   Copy the app's UUID from its URL in the dashboard.

**Vercel**

1. Sign in at vercel.com with GitHub and create two projects from this repository:
   `couchwave-host` with Root Directory `apps/host`, and `couchwave-controller` with Root
   Directory `apps/controller`. Vercel's own Git deploys are switched off in each `vercel.json`,
   so only CI deploys.
2. Create a token under Account Settings → Tokens.
3. Copy the Team ID (Team Settings → General) and each Project ID (Project Settings → General).

**GitHub** → Settings → Secrets and variables → Actions:

| Variable           | Value                                                |
| ------------------ | ---------------------------------------------------- |
| `API_URL`          | the API's public URL, e.g. `https://api.example.com` |
| `COOLIFY_URL`      | Coolify only: the dashboard URL                      |
| `COOLIFY_APP_UUID` | Coolify only: the API app's UUID                     |

| Secret                         | Value                         |
| ------------------------------ | ----------------------------- |
| `RENDER_DEPLOY_HOOK_URL`       | Render only: the deploy hook  |
| `COOLIFY_TOKEN`                | Coolify only: the API token   |
| `VERCEL_TOKEN`                 | the Vercel token              |
| `VERCEL_ORG_ID`                | the Vercel Team ID            |
| `VERCEL_HOST_PROJECT_ID`       | the `couchwave-host` ID       |
| `VERCEL_CONTROLLER_PROJECT_ID` | the `couchwave-controller` ID |

When `RENDER_DEPLOY_HOOK_URL` is set CI deploys to Render, otherwise to Coolify if its
settings exist. The API address lives only in the `API_URL` variable; changing it and re-running the workflow
moves both web apps to the new API. If a `*.vercel.app` name is taken, update the Vercel URLs
in `ci.yml`, `apps/host/.env.production` and the API's `CORS_ORIGINS`.

## Roadmap

- [x] **M0** Monorepo, CI, create/join rooms with a live lobby
- [x] **M1a** Reconnection with a grace period
- [x] **M1b** Deploy API + web apps
- [x] **M2** First mini-game: quick-fire trivia
- [x] **M3a** Home, About and Contacts pages; first player is the host (start, kick, end)
- [x] **M3b** Games library navigated from the host's phone; avatars (presets + selfie);
      lobby reactions; TV reconnection; rooms close when the TV is gone
- [x] **M3c** Trivia v2: settings, ready-up, 6 topics, risk-based scoring, answered marks,
      avatars on answers, podium, play again
- [ ] **M4** Accounts (email/password + Google), profiles, contact form backed by a database,
      AI-generated question packs
- [ ] **M5** Native app: QR scanner, deep links, haptics, game history, "recently played with"
- [x] **M6a** Draw & Guess: live drawing from the phone to the TV, guesses, hints
- [ ] **M6b** More games: bluff
- [ ] **M7** Redis-backed rooms, load testing, observability
