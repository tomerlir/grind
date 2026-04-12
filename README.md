# Grind — Structured Strength

Minimalist fitness PWA for structured, slightly randomized hypertrophy training. The app keeps the A/B/C full-body split fixed, then adds controlled exercise variation, session persistence, PR tracking, and a session-builder reveal flow.

## Tech Stack

- Vanilla JavaScript with Vite as the dev server and bundler
- HTML plus custom CSS in `src/styles/app.css`
- `localStorage` for week state, active sessions, history, PRs, and sync queue
- `vite-plugin-pwa` for installability and offline support

## Running Locally

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`

## Project Structure

```text
grind/
  index.html
  src/
    main.js
    app/
      runtime.js
    data/
      workouts.js
    lib/
      storage.js
    config.js
  assets/
  docs/
  vite.config.mjs
```

### Module responsibilities

- `src/main.js`: browser entrypoint, app boot, service worker update prompt, `?test` harness
- `src/app/runtime.js`: session flow, onboarding, spin logic, exercise logging, history UI, sync UI, event wiring
- `src/data/workouts.js`: workout templates and exercise pools
- `src/lib/storage.js`: guarded `localStorage` helpers
- `src/config.js`: app-level runtime configuration

## Architectural Notes

- The project remains framework-free.
- This refactor intentionally modularizes JavaScript first.
- The UI remains framework-free and CSS-first.
- Storage keys and existing session/history behavior are preserved for backward compatibility.

## Data Model

State is stored in `localStorage` under the `grind:` namespace:

- weekly completion and used-exercise tracking
- active in-progress session
- completed session history
- PR records and overload nudge history
- offline sync queue

See `docs/ARCHITECTURE.md` for the detailed schema and screen flow.

## Development Guidance

- Preserve the vanilla JS approach; do not introduce a framework casually.
- Prefer adding new code under `src/` rather than rebuilding root-level entry files.
- Keep behavior changes separate from structural refactors when possible.
- Maintain storage compatibility unless a migration is explicitly planned.

## License

Private repository — not for redistribution.
